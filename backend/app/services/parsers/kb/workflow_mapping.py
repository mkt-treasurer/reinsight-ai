"""Phase 3a — map Phase-2 claim transitions onto the broker workflow.

The diff engine produces eight :class:`TransitionType` values that
describe what KB sent us this month vs last month. Most of them are
audit events orthogonal to the broker's own workflow stages
(``booked → soc_received → sent_to_reinsurer → payment_received →
completed``), so this module records every transition in three new
``claims`` columns but only escalates one (``DISMISSED``) all the
way to a ``workflow_status`` change.

The split keeps the two axes independent:

- ``workflow_status`` keeps tracking what *INS Corp* has done
  (sent, received payment, etc.).
- ``last_transition`` / ``last_transition_at`` /
  ``last_diff_audit_severity`` track what *KB* has done in their
  monthly bordereau drops.

Phase 3a ships only the mapping function and a dry-run-only
:class:`WorkflowSyncer` interface. Live writes land in Phase 3c.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from .monthly_diff import (
    ANOMALY_REGRESSION,
    DRIFT_AMBIGUOUS,
    DRIFT_UNIQUE,
    ClaimTransition,
    TransitionType,
)


# ─── Severity ──────────────────────────────────────────────────────────────


class AuditSeverity(str, Enum):
    """How loudly the audit pipeline should surface a transition.

    - ``info``    — routine / expected (UNCHANGED, REVISION_BUMP, NEW, …)
    - ``warning`` — needs human eyes (REVISION_GAP, REOPENED, casualty drift)
    - ``anomaly`` — escalation-worthy (REVISION_REGRESSION)
    """

    INFO = "info"
    WARNING = "warning"
    ANOMALY = "anomaly"


# ─── Workflow status values (string constants, not an enum) ────────────────


# Existing pre-Phase-3a status values, surfaced as constants so callers
# can avoid magic strings. ``Claim.workflow_status`` is still a free
# String(30) — these are the meaningful values it actually carries.
WS_BOOKED = "booked"
WS_SOC_RECEIVED = "soc_received"
WS_SENT_TO_REINSURER = "sent_to_reinsurer"
WS_PAYMENT_RECEIVED = "payment_received"
WS_COMPLETED = "completed"
WS_DRAFT_READY = "draft_ready"
WS_DELETED = "deleted"

# New value introduced by Phase 3a.
WS_DISMISSED = "dismissed"


# ─── Mapping output ────────────────────────────────────────────────────────


@dataclass(frozen=True)
class WorkflowImpact:
    """The decision a single transition produces.

    ``new_status`` is ``None`` whenever the transition is purely
    informational at the audit level; only DISMISSED forces a
    ``workflow_status`` change in Phase 3a's rule set.

    ``last_transition`` is always populated so audit dashboards can
    filter on it without joining the diff log table.
    """

    last_transition: str
    audit_severity: AuditSeverity
    new_status: Optional[str] = None
    notes: tuple[str, ...] = field(default_factory=tuple)


# ─── Severity table ────────────────────────────────────────────────────────


_BASE_SEVERITY: dict[TransitionType, AuditSeverity] = {
    TransitionType.NEW: AuditSeverity.INFO,
    TransitionType.REOPENED: AuditSeverity.WARNING,
    TransitionType.UNCHANGED: AuditSeverity.INFO,
    TransitionType.REVISION_BUMP: AuditSeverity.INFO,
    TransitionType.REVISION_GAP: AuditSeverity.WARNING,
    TransitionType.REVISION_REGRESSION: AuditSeverity.ANOMALY,
    TransitionType.SETTLED: AuditSeverity.INFO,
    TransitionType.DISMISSED: AuditSeverity.INFO,
}


# Workflow_status update rule per transition. ``None`` means the
# transition does not touch ``workflow_status`` at all; the broker
# workflow continues to be driven by the existing claim_workflow.py
# triggers (send / mark-paid / etc.).
_WORKFLOW_RULE: dict[TransitionType, Optional[str]] = {
    TransitionType.NEW: None,
    TransitionType.REOPENED: None,
    TransitionType.UNCHANGED: None,
    TransitionType.REVISION_BUMP: None,
    TransitionType.REVISION_GAP: None,
    TransitionType.REVISION_REGRESSION: None,
    TransitionType.SETTLED: None,
    TransitionType.DISMISSED: WS_DISMISSED,
}


# ─── Public mapper ─────────────────────────────────────────────────────────


def map_transition_to_workflow(
    transition: ClaimTransition,
    current_status: Optional[str] = None,
) -> WorkflowImpact:
    """Decide what a single :class:`ClaimTransition` should do to the
    underlying claim row.

    ``current_status`` is the existing ``Claim.workflow_status`` value
    on the row; we use it to avoid downgrading a terminal state.
    Specifically, when a claim is already ``completed`` we don't
    overwrite it with ``dismissed`` even if a stale DISMISSED arrives
    later — that almost certainly indicates a data inconsistency that
    deserves an audit warning, not a silent state change.
    """
    base_severity = _BASE_SEVERITY[transition.transition]
    proposed_status = _WORKFLOW_RULE[transition.transition]

    notes: list[str] = []
    severity = base_severity

    # Drift / ambiguity notes from the diff engine bump the severity
    # one notch — these are exactly the cases the operator queue is
    # supposed to triage.
    if any(DRIFT_UNIQUE in n for n in transition.notes):
        notes.append("audit:casualty_drift")
        if severity == AuditSeverity.INFO:
            severity = AuditSeverity.WARNING
    if any(DRIFT_AMBIGUOUS in n for n in transition.notes):
        notes.append("audit:casualty_ambiguous")
        if severity == AuditSeverity.INFO:
            severity = AuditSeverity.WARNING
    if ANOMALY_REGRESSION in transition.notes:
        # Already ANOMALY by base; pin it explicitly anyway so the
        # downstream audit log carries the same literal.
        notes.append(ANOMALY_REGRESSION)

    new_status = proposed_status
    if proposed_status is not None and current_status is not None:
        # Don't overwrite a more advanced state with DISMISSED. If
        # KB issued a settlement-then-dismiss pattern, the broker
        # workflow's ``completed``/``payment_received``/``sent_to_reinsurer``
        # all describe states where money has changed hands — flipping
        # them to ``dismissed`` would hide that history.
        if current_status in (
            WS_COMPLETED, WS_PAYMENT_RECEIVED, WS_SENT_TO_REINSURER,
        ):
            new_status = None
            notes.append(
                f"workflow_protected: refusing to overwrite "
                f"{current_status!r} with {proposed_status!r}"
            )
            severity = AuditSeverity.WARNING

    return WorkflowImpact(
        last_transition=transition.transition.value,
        audit_severity=severity,
        new_status=new_status,
        notes=tuple(notes),
    )


# ─── Syncer (Phase 3a: dry-run interface only) ─────────────────────────────


@dataclass
class SyncResult:
    """Per-row outcome returned by :meth:`WorkflowSyncer.apply`.

    Phase 3a only populates the planned-impact fields; the actual
    write happens in Phase 3c. Storing the dry-run results lets callers
    persist an audit log even before the live-write path lands.
    """

    transition: ClaimTransition
    impact: WorkflowImpact
    applied: bool
    detected_at: datetime


class WorkflowSyncer:
    """Apply Phase-2 transitions to ``claims`` rows.

    Phase 3a ships the interface and the dry-run path. Phase 3c will
    add the live SQL write behind ``apply(..., dry_run=False)``.

    The class takes no DB session in Phase 3a — keeping the API stable
    while ensuring nothing accidentally writes. The ``db_session``
    parameter exists for forward compatibility but raises
    :class:`NotImplementedError` if a live write is requested.
    """

    def __init__(self, *, db_session: object | None = None):
        self._db_session = db_session

    def apply(
        self,
        transition: ClaimTransition,
        *,
        current_status: Optional[str] = None,
        dry_run: bool = True,
    ) -> SyncResult:
        """Compute the impact of one transition.

        ``dry_run=True`` (the default and the only path supported in
        Phase 3a) returns the planned :class:`WorkflowImpact` without
        touching any database. Phase 3c will flip the default and add
        the actual UPDATE behind ``dry_run=False``.
        """
        if not dry_run:
            raise NotImplementedError(
                "live writes are deferred to Phase 3c; "
                "Phase 3a supports dry_run=True only"
            )

        impact = map_transition_to_workflow(transition, current_status=current_status)
        return SyncResult(
            transition=transition,
            impact=impact,
            applied=False,
            detected_at=datetime.now(timezone.utc),
        )

    def apply_many(
        self,
        transitions: list[ClaimTransition],
        *,
        current_status_lookup: Optional[dict[tuple, str]] = None,
        dry_run: bool = True,
    ) -> list[SyncResult]:
        """Bulk version of :meth:`apply`. Useful for the audit script
        that runs the whole monthly diff through the syncer in one go.

        ``current_status_lookup`` maps a transition's ``base_key`` to
        the existing ``workflow_status`` on the corresponding claim
        row. Anything missing from the lookup is treated as
        ``current_status=None`` (no protection clause).
        """
        lookup = current_status_lookup or {}
        return [
            self.apply(
                t,
                current_status=lookup.get(t.base_key),
                dry_run=dry_run,
            )
            for t in transitions
        ]
