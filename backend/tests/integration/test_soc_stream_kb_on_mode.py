"""KB_PARSER_MODE=ON — LLM prompt gets the deterministic context.

Phase 3c does **not** override the LLM-produced SOCs even in ON mode;
the deterministic result only enters the system as additional prompt
context. These tests verify the wiring is in place; Phase 3d will add
the override path.
"""

from __future__ import annotations

import os
import warnings

import pytest

from ._helpers import (
    REAL_PLA_INS,
    fake_llm_response_for_kb_pla,
    kb_int_module,
    kb_parser_mode,
)

warnings.filterwarnings("ignore")


class TestOnModeGate:
    def test_on_without_approval_raises(self):
        # Force the env into the bad state and verify the config
        # module refuses to load.
        saved_mode = os.environ.get("KB_PARSER_MODE")
        saved_approved = os.environ.get("KB_PARSER_ON_APPROVED")
        os.environ["KB_PARSER_MODE"] = "on"
        os.environ.pop("KB_PARSER_ON_APPROVED", None)
        try:
            import importlib
            import app.config
            with pytest.raises(RuntimeError, match="KB_PARSER_ON_APPROVED"):
                importlib.reload(app.config)
        finally:
            if saved_mode is None:
                os.environ.pop("KB_PARSER_MODE", None)
            else:
                os.environ["KB_PARSER_MODE"] = saved_mode
            if saved_approved is None:
                os.environ.pop("KB_PARSER_ON_APPROVED", None)
            else:
                os.environ["KB_PARSER_ON_APPROVED"] = saved_approved
            import app.config
            importlib.reload(app.config)
            import app.services.soc_stream_kb_integration as kb_int
            importlib.reload(kb_int)


class TestOnMode:
    def test_try_parse_returns_llm_context_string(self):
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            result = kb_int.try_parse_kb_xlsx(
                ctx, str(REAL_PLA_INS), "PLA_FAC_INS_2026.02.xlsx",
            )
            assert result is not None
            assert "[KB 결정론 파싱 결과" in result
            assert "행 수: 71" in result

    def test_cross_check_runs_in_on_mode(self):
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            kb_int.try_parse_kb_xlsx(
                ctx, str(REAL_PLA_INS), "PLA_FAC_INS_2026.02.xlsx",
            )
            results = kb_int.run_kb_cross_checks(
                ctx, fake_llm_response_for_kb_pla(),
            )
            assert len(results) == 1

    def test_phase_3d_hook_still_returns_empty(self):
        """Phase 3c always passes ``transitions=[]`` to the hook even
        in ON mode — the diff producer doesn't exist yet. Phase 3d
        flips the producer on without changing this call site."""
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            kb_int.try_parse_kb_xlsx(
                ctx, str(REAL_PLA_INS), "PLA_FAC_INS_2026.02.xlsx",
            )
            sync_results = kb_int.invoke_phase_3d_hook(ctx)
            assert sync_results == []

    def test_audit_payload_records_on_mode(self):
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            kb_int.try_parse_kb_xlsx(
                ctx, str(REAL_PLA_INS), "PLA_FAC_INS_2026.02.xlsx",
            )
            kb_int.run_kb_cross_checks(ctx, fake_llm_response_for_kb_pla())
            payload: dict = {}
            kb_int.finalize_kb_integration(ctx, payload)
            assert payload["kb_audit"]["mode"] == "on"

    def test_does_not_override_llm_response(self):
        """Phase 3c stays observation-only; cross_check returns a
        result but never mutates the LLM response dict the caller
        uses to build SOCs."""
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            kb_int.try_parse_kb_xlsx(
                ctx, str(REAL_PLA_INS), "PLA_FAC_INS_2026.02.xlsx",
            )
            llm = fake_llm_response_for_kb_pla()
            import copy
            before = copy.deepcopy(llm)
            kb_int.run_kb_cross_checks(ctx, llm)
            assert llm == before, "LLM response must be untouched"
