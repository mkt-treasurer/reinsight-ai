"""KB_PARSER_MODE=SHADOW — parser runs, audit recorded, LLM prompt untouched."""

from __future__ import annotations

import warnings

import pytest

from ._helpers import (
    REAL_PLA_INS,
    fake_llm_response_for_kb_pla,
    kb_int_module,
    kb_parser_mode,
)

warnings.filterwarnings("ignore")


class TestShadowMode:
    def test_active_context_initialised(self):
        with kb_parser_mode("shadow"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            assert ctx.active is True
            assert any(
                e["event"] == "kb_integration_initialised"
                for e in ctx.audit_events
            )

    def test_parser_runs_but_returns_no_llm_context(self):
        """SHADOW parses the file (so cross-check has data) but
        deliberately returns ``None`` from ``try_parse_kb_xlsx`` so
        the LLM prompt isn't modified."""
        with kb_parser_mode("shadow"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            result = kb_int.try_parse_kb_xlsx(
                ctx, str(REAL_PLA_INS), "PLA_FAC_INS_2026.02.xlsx",
            )
            assert result is None  # no context injection
            assert len(ctx.parsed_results) == 1
            kb_parsed_events = [
                e for e in ctx.audit_events if e["event"] == "kb_parsed"
            ]
            assert len(kb_parsed_events) == 1

    def test_cross_check_runs_and_records(self):
        with kb_parser_mode("shadow"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            kb_int.try_parse_kb_xlsx(
                ctx, str(REAL_PLA_INS), "PLA_FAC_INS_2026.02.xlsx",
            )
            results = kb_int.run_kb_cross_checks(
                ctx, fake_llm_response_for_kb_pla(),
            )
            assert len(results) == 1
            # The fake LLM response doesn't fully match the 71-row
            # fixture, so we expect a non-OK severity.
            assert results[0].severity in (
                "info", "warning", "fail",
            )
            assert any(
                e["event"] == "cross_check"
                for e in ctx.audit_events
            )

    def test_finalize_attaches_kb_audit_to_evidence(self):
        with kb_parser_mode("shadow"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            kb_int.try_parse_kb_xlsx(
                ctx, str(REAL_PLA_INS), "PLA_FAC_INS_2026.02.xlsx",
            )
            kb_int.run_kb_cross_checks(ctx, fake_llm_response_for_kb_pla())

            payload: dict = {}
            kb_int.finalize_kb_integration(ctx, payload)
            assert "kb_audit" in payload
            assert payload["kb_audit"]["mode"] == "shadow"
            assert len(payload["kb_audit"]["events"]) >= 2
            # Phase 3d hook should fire and produce 0 transitions.
            phase_3d = [
                e for e in payload["kb_audit"]["events"]
                if e["event"] == "phase_3d_hook_invoked"
            ]
            assert len(phase_3d) == 1
            assert phase_3d[0]["transition_count"] == 0
