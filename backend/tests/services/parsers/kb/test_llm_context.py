"""Tests for :func:`to_llm_context`.

Pin the structure / token-economy decisions so we don't accidentally
break the LLM prompt when refactoring the rendering helpers.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.parsers.kb import to_llm_context

from ._builders import make_result, make_row


class TestToLlmContext:
    def test_includes_sheet_kind_and_recipient(self):
        result = make_result([make_row()])
        text = to_llm_context(result)
        assert "PLA (OS List)" in text
        assert "인스보험중개, SEOUL, KOREA" in text

    def test_row_lines_carry_natural_key_components(self):
        rows = [
            make_row(
                ref="20260204009404", revision=1,
                casualty="박*배", item_serial=1, cession_serial=1,
                row_index=13,
            ),
        ]
        text = to_llm_context(make_result(rows))
        # Each row line tags fields explicitly — the LLM can copy
        # ref values without re-deriving them.
        assert "ref=2026-0204009404 001" in text
        assert "cas=박*배" in text
        assert "item=1" in text
        assert "cession=1" in text
        assert "rev=1" in text
        assert "row=13" in text

    def test_loss_description_is_dropped(self):
        # Long Korean free text shouldn't burn prompt tokens.
        rows = [make_row(loss_description="한 시간짜리 사고 설명서 ...")]
        text = to_llm_context(make_result(rows))
        assert "한 시간짜리 사고 설명서" not in text

    def test_zero_amounts_omitted_to_keep_lines_short(self):
        rows = [
            make_row(
                ref="20260204009404", revision=1,
                amounts={"os_loss_indemnity": Decimal("0"), "os_expense": Decimal("100000")},
            ),
        ]
        text = to_llm_context(make_result(rows))
        # Zero amount column dropped; non-zero kept.
        assert "os_loss_indemnity=0" not in text
        assert "os_expense=100000" in text

    def test_warnings_appended_when_present(self):
        result = make_result([make_row()])
        result.warnings = ["row 14: ref_no parse failed"]
        text = to_llm_context(result)
        assert "결정론 파서 경고" in text
        assert "ref_no parse failed" in text

    def test_truncation_marker_when_over_max(self):
        from app.services.parsers.kb.llm_context import _MAX_ROWS

        rows = [
            make_row(ref=f"2026020100{i:04d}", row_index=13 + i)
            for i in range(_MAX_ROWS + 5)
        ]
        text = to_llm_context(make_result(rows))
        # The header line carries the truncation hint.
        assert f"앞 {_MAX_ROWS}행만 표시" in text

    def test_empty_totals_section_renders_without_crashing(self):
        result = make_result([make_row()])
        # totals_by_currency is already empty by default in make_result
        text = to_llm_context(result)
        assert "(no totals row in source)" in text
