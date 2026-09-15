"""Tests for the Phase-3a transition → workflow mapping."""

from __future__ import annotations

import pytest

from app.services.parsers.kb import (
    AuditSeverity,
    ClaimTransition,
    SyncResult,
    TransitionType,
    WorkflowImpact,
    WorkflowSyncer,
    map_transition_to_workflow,
)
from app.services.parsers.kb.monthly_diff import (
    ANOMALY_REGRESSION,
    DRIFT_AMBIGUOUS,
    DRIFT_UNIQUE,
)
from app.services.parsers.kb.workflow_mapping import (
    WS_COMPLETED,
    WS_DISMISSED,
    WS_PAYMENT_RECEIVED,
    WS_SENT_TO_REINSURER,
    WS_SOC_RECEIVED,
)

from ._builders import make_row


# ─── Helpers ───────────────────────────────────────────────────────────────


def _transition(
    kind: TransitionType,
    *,
    notes: tuple[str, ...] = (),
    base_key: tuple = ("INS", "2026-0101000001", "victim", 1, 1),
) -> ClaimTransition:
    """Compose a synthetic ``ClaimTransition`` purely for the mapping
    tests; we don't care about the row payload here, just the kind +
    notes the mapper consumes."""
    prev = make_row(ref="20260101000001", revision=0)
    curr = make_row(ref="20260101000001", revision=1)
    return ClaimTransition(
        base_key=base_key,
        transition=kind,
        previous=prev,
        current=curr,
        soc_seen=False,
        notes=notes,
    )


# ─── Per-transition mapping ────────────────────────────────────────────────


class TestMappingPerTransition:
    @pytest.mark.parametrize("kind,severity", [
        (TransitionType.NEW, AuditSeverity.INFO),
        (TransitionType.UNCHANGED, AuditSeverity.INFO),
        (TransitionType.REVISION_BUMP, AuditSeverity.INFO),
        (TransitionType.SETTLED, AuditSeverity.INFO),
        (TransitionType.DISMISSED, AuditSeverity.INFO),
        (TransitionType.REOPENED, AuditSeverity.WARNING),
        (TransitionType.REVISION_GAP, AuditSeverity.WARNING),
        (TransitionType.REVISION_REGRESSION, AuditSeverity.ANOMALY),
    ])
    def test_base_severity(self, kind, severity):
        impact = map_transition_to_workflow(_transition(kind))
        assert impact.audit_severity == severity

    def test_dismissed_sets_workflow_status(self):
        impact = map_transition_to_workflow(_transition(TransitionType.DISMISSED))
        assert impact.new_status == WS_DISMISSED
        assert impact.last_transition == "dismissed"

    @pytest.mark.parametrize("kind", [
        TransitionType.NEW,
        TransitionType.REOPENED,
        TransitionType.UNCHANGED,
        TransitionType.REVISION_BUMP,
        TransitionType.REVISION_GAP,
        TransitionType.REVISION_REGRESSION,
        TransitionType.SETTLED,
    ])
    def test_other_transitions_leave_workflow_status_alone(self, kind):
        impact = map_transition_to_workflow(_transition(kind))
        assert impact.new_status is None, (
            f"{kind.name} should not modify workflow_status — broker "
            f"workflow stays orthogonal to cedant transitions"
        )

    def test_last_transition_always_populated(self):
        for kind in TransitionType:
            impact = map_transition_to_workflow(_transition(kind))
            assert impact.last_transition == kind.value


# ─── Severity escalation from notes ────────────────────────────────────────


class TestSeverityEscalation:
    def test_drift_unique_escalates_info_to_warning(self):
        t = _transition(
            TransitionType.DISMISSED,
            notes=(f"{DRIFT_UNIQUE}: example",),
        )
        impact = map_transition_to_workflow(t)
        assert impact.audit_severity == AuditSeverity.WARNING
        assert "audit:casualty_drift" in impact.notes

    def test_drift_ambiguous_escalates_info_to_warning(self):
        t = _transition(
            TransitionType.NEW,
            notes=(f"{DRIFT_AMBIGUOUS}: siblings",),
        )
        impact = map_transition_to_workflow(t)
        assert impact.audit_severity == AuditSeverity.WARNING
        assert "audit:casualty_ambiguous" in impact.notes

    def test_anomaly_regression_marker_propagated(self):
        t = _transition(
            TransitionType.REVISION_REGRESSION,
            notes=(ANOMALY_REGRESSION, "revision regressed: 2 → 1"),
        )
        impact = map_transition_to_workflow(t)
        # Already at ANOMALY by base; the marker shows up in mapper notes.
        assert impact.audit_severity == AuditSeverity.ANOMALY
        assert ANOMALY_REGRESSION in impact.notes

    def test_drift_does_not_demote_anomaly(self):
        t = _transition(
            TransitionType.REVISION_REGRESSION,
            notes=(ANOMALY_REGRESSION, f"{DRIFT_UNIQUE}: drifted"),
        )
        impact = map_transition_to_workflow(t)
        assert impact.audit_severity == AuditSeverity.ANOMALY


# ─── current_status protection clauses ─────────────────────────────────────


class TestCurrentStatusProtection:
    """DISMISSED is the only transition that sets workflow_status
    in Phase 3a, but we don't want it to overwrite states that
    represent money already in motion. Protect those terminals."""

    @pytest.mark.parametrize("protected_status", [
        WS_COMPLETED,
        WS_PAYMENT_RECEIVED,
        WS_SENT_TO_REINSURER,
    ])
    def test_dismissed_does_not_overwrite_money_states(self, protected_status):
        t = _transition(TransitionType.DISMISSED)
        impact = map_transition_to_workflow(t, current_status=protected_status)
        assert impact.new_status is None
        assert any("workflow_protected" in n for n in impact.notes)
        assert impact.audit_severity == AuditSeverity.WARNING

    @pytest.mark.parametrize("permissive_status", [
        "booked",
        "soc_received",
        "draft_ready",
        None,
    ])
    def test_dismissed_overwrites_pre_payment_states(self, permissive_status):
        t = _transition(TransitionType.DISMISSED)
        impact = map_transition_to_workflow(t, current_status=permissive_status)
        assert impact.new_status == WS_DISMISSED
        assert all("workflow_protected" not in n for n in impact.notes)


# ─── WorkflowSyncer (Phase 3a dry-run only) ────────────────────────────────


class TestWorkflowSyncerDryRun:
    def test_apply_returns_sync_result(self):
        syncer = WorkflowSyncer()
        t = _transition(TransitionType.NEW)
        result = syncer.apply(t)
        assert isinstance(result, SyncResult)
        assert result.transition is t
        assert isinstance(result.impact, WorkflowImpact)
        assert result.applied is False

    def test_apply_threads_current_status_through(self):
        syncer = WorkflowSyncer()
        t = _transition(TransitionType.DISMISSED)
        result = syncer.apply(t, current_status=WS_COMPLETED)
        # Protected — new_status should be None.
        assert result.impact.new_status is None

    def test_live_write_raises(self):
        syncer = WorkflowSyncer()
        with pytest.raises(NotImplementedError, match="Phase 3c"):
            syncer.apply(_transition(TransitionType.NEW), dry_run=False)

    def test_apply_many_uses_lookup(self):
        syncer = WorkflowSyncer()
        t1 = _transition(
            TransitionType.DISMISSED,
            base_key=("INS", "ref-1", "c", 1, 1),
        )
        t2 = _transition(
            TransitionType.DISMISSED,
            base_key=("INS", "ref-2", "c", 1, 1),
        )
        lookup = {
            t1.base_key: WS_COMPLETED,    # protected
            t2.base_key: WS_SOC_RECEIVED,  # permissive
        }
        results = syncer.apply_many([t1, t2], current_status_lookup=lookup)
        assert results[0].impact.new_status is None  # protected
        assert results[1].impact.new_status == WS_DISMISSED

    def test_apply_many_missing_lookup_treats_as_no_current_status(self):
        syncer = WorkflowSyncer()
        t = _transition(TransitionType.DISMISSED)
        results = syncer.apply_many([t])  # no lookup supplied
        # Without current_status, no protection clause kicks in.
        assert results[0].impact.new_status == WS_DISMISSED
