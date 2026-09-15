"""KB_PARSER_MODE=OFF — strict legacy parity.

The whole point of OFF is to be invisible. Every helper short-circuits,
``evidence_payload`` doesn't gain any new keys, and the parser is
never even imported through the integration module's hot path.
"""

from __future__ import annotations

import copy

import pytest

from ._helpers import REAL_PLA_INS, kb_int_module, kb_parser_mode


class TestOffMode:
    def test_init_returns_inactive_context(self):
        with kb_parser_mode("off"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            assert ctx.active is False
            # No init audit event in OFF mode either.
            assert ctx.audit_events == []

    def test_try_parse_does_not_invoke_parser(self):
        """OFF must not call ``parse_kb_bordereau``; the audit event
        list stays empty even when handed a real KB xlsx."""
        with kb_parser_mode("off"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            result = kb_int.try_parse_kb_xlsx(ctx, str(REAL_PLA_INS), "PLA.xlsx")
            assert result is None
            assert ctx.parsed_results == {}
            assert ctx.audit_events == []
            assert len(ctx.soc_history) == 0

    def test_finalize_leaves_evidence_payload_byte_identical(self):
        with kb_parser_mode("off"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            payload = {
                "file_reinsurer": {"name": "X", "share": 0.1, "amount": 100},
                "past_claims": {"search_method": "x", "rows": []},
                "contracts": {"search_method": "x", "rows": []},
                "policy_match": None,
            }
            before = copy.deepcopy(payload)
            kb_int.finalize_kb_integration(ctx, payload)
            assert payload == before, (
                "evidence_payload must be byte-identical in OFF mode"
            )
            assert "kb_audit" not in payload
