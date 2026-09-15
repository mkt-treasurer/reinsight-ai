"""Tests for the Phase-3d hook placeholder.

Phase 3c calls :func:`apply_workflow_transitions` with
``transitions=[]`` always — the function must be a perfect no-op in
that case (no syncer constructed, no DB write attempted, return an
empty list). When Phase 3d wires real transitions in, the same
function must thread the ``mode`` correctly into ``dry_run``.
"""

from __future__ import annotations

import pytest

from app.config import KBParserMode
from app.services.parsers.kb import (
    ClaimTransition,
    TransitionType,
    apply_workflow_transitions,
)
from app.services.parsers.kb.workflow_mapping import WS_DISMISSED

from ._builders import make_row


def _t(kind: TransitionType = TransitionType.UNCHANGED) -> ClaimTransition:
    return ClaimTransition(
        base_key=("INS", "ref", "casualty", 1, 1),
        transition=kind,
        previous=make_row(),
        current=make_row(),
        soc_seen=False,
        notes=(),
    )


class TestPhase3cNoOpPath:
    @pytest.mark.parametrize("mode", [KBParserMode.OFF, KBParserMode.SHADOW, KBParserMode.ON])
    def test_empty_transitions_returns_empty_in_every_mode(self, mode):
        results = apply_workflow_transitions([], mode=mode)
        assert results == []


class TestPhase3dActivePath:
    """Future Phase-3d: transitions actually arrive. Verify the
    behaviour is correct so when 3d flips the producer on, the wiring
    here doesn't need touching."""

    def test_off_mode_uses_dry_run(self):
        results = apply_workflow_transitions(
            [_t(TransitionType.DISMISSED)], mode=KBParserMode.OFF,
        )
        assert len(results) == 1
        assert results[0].applied is False  # dry_run=True

    def test_shadow_mode_uses_dry_run(self):
        results = apply_workflow_transitions(
            [_t(TransitionType.DISMISSED)], mode=KBParserMode.SHADOW,
        )
        assert results[0].applied is False

    def test_on_mode_threads_dry_run_false_through(self):
        """Phase 3c keeps the live-write SQL deferred to Phase 3d, so
        ``WorkflowSyncer.apply(dry_run=False)`` still raises today.
        Reaching that exception when ON mode is requested with a real
        transition is the canary that confirms the wiring is correct —
        Phase 3d will replace the raise with an actual UPDATE."""
        with pytest.raises(NotImplementedError, match="Phase 3c"):
            apply_workflow_transitions(
                [_t(TransitionType.DISMISSED)],
                mode=KBParserMode.ON,
            )

    def test_current_status_lookup_threaded_through(self):
        from app.services.parsers.kb.workflow_mapping import WS_COMPLETED
        # In OFF mode (dry_run=True), passing a protected current_status
        # should still surface the protection clause in the result.
        t = _t(TransitionType.DISMISSED)
        results = apply_workflow_transitions(
            [t],
            mode=KBParserMode.OFF,
            current_status_lookup={t.base_key: WS_COMPLETED},
        )
        # Protected — new_status should be None in the impact.
        assert results[0].impact.new_status is None
