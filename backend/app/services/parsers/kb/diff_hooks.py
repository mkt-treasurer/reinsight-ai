"""Phase 3d hook — placeholder for the WorkflowSyncer trigger point.

Phase 3c integrates the deterministic parser into ``soc_stream`` but
does **not** apply any workflow transitions. Single-document uploads
have no previous-month context, so there's nothing to diff and
``WorkflowSyncer.apply(dry_run=False)`` has no input to act on.

This module exists so Phase 3c can wire the call site once and Phase
3d can flip behaviour by populating ``transitions`` from a real
:func:`diff_monthly` invocation. The signature is stable; only the
producer changes.

Operationally, calling this in Phase 3c is a no-op: ``transitions``
is always empty so the syncer doesn't enter ``apply``.
"""

from __future__ import annotations

import logging
from typing import Optional

from .monthly_diff import ClaimTransition
from .workflow_mapping import SyncResult, WorkflowSyncer

from app.config import KBParserMode

logger = logging.getLogger(__name__)


def apply_workflow_transitions(
    transitions: list[ClaimTransition],
    *,
    mode: KBParserMode,
    syncer: Optional[WorkflowSyncer] = None,
    current_status_lookup: Optional[dict[tuple, str]] = None,
) -> list[SyncResult]:
    """Run :class:`WorkflowSyncer` over the provided transitions.

    The mode controls the live-write switch:

    - ``OFF`` / ``SHADOW`` → ``dry_run=True`` (no DB write).
    - ``ON``               → ``dry_run=False`` (live update).

    In Phase 3c the caller always passes ``transitions=[]`` because
    the diff step that produces them isn't wired up yet, so the
    ``dry_run=False`` path is never hit. The function is still safe
    if a future caller hands it real transitions — the protection
    clauses on :func:`workflow_mapping.map_transition_to_workflow`
    keep ``completed`` / ``payment_received`` /
    ``sent_to_reinsurer`` rows untouched even under ``ON``.
    """
    if not transitions:
        # Hot path during Phase 3c. Avoid syncer construction so this
        # is genuinely free.
        return []

    syncer = syncer or WorkflowSyncer()
    dry_run = mode is not KBParserMode.ON

    if not dry_run:
        logger.info(
            "apply_workflow_transitions: live writes enabled (mode=ON), "
            "%d transitions queued",
            len(transitions),
        )

    return syncer.apply_many(
        transitions,
        current_status_lookup=current_status_lookup,
        dry_run=dry_run,
    )
