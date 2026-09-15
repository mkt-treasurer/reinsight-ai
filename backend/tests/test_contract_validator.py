"""Unit tests for `services.contract_validator`.

Pure logic — no DB, no FastAPI — so this can run with just pytest installed.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

import pytest

from app.services.contract_validator import (
    DEFAULT_EPSILON,
    ShareSumError,
    assert_share_sum,
    soft_check_for_fallback,
    validate_share_sum,
)


@dataclass
class _Row:
    """Stand-in for a SQLAlchemy Contract row."""

    id: int
    cover_note_no: str | None
    year: int | None
    share: float | Decimal | None


def _rows(*specs: tuple[int, str | None, int | None, float | Decimal | None]) -> list[_Row]:
    return [_Row(*s) for s in specs]


class TestValidateShareSum:
    def test_single_contract_at_full_share_is_ok(self):
        result = validate_share_sum(_rows((1, "CN-1", 2025, 1.0)))
        assert result.ok
        assert len(result.groups) == 1
        assert result.groups[0].share_sum == pytest.approx(1.0)

    def test_clean_split_sums_to_one(self):
        result = validate_share_sum(_rows(
            (1, "CN-1", 2025, 0.30),
            (2, "CN-1", 2025, 0.20),
            (3, "CN-1", 2025, 0.50),
        ))
        assert result.ok
        assert result.failed == ()

    def test_under_allocated_group_fails(self):
        result = validate_share_sum(_rows(
            (1, "CN-1", 2025, 0.50),
            (2, "CN-1", 2025, 0.45),
        ))
        assert not result.ok
        (g,) = result.failed
        assert g.cover_note_no == "CN-1"
        assert g.share_sum == pytest.approx(0.95)
        assert g.delta == pytest.approx(-0.05)

    def test_over_allocated_group_fails(self):
        result = validate_share_sum(_rows(
            (1, "CN-1", 2025, 0.55),
            (2, "CN-1", 2025, 0.50),
        ))
        assert not result.ok
        (g,) = result.failed
        assert g.share_sum == pytest.approx(1.05)
        assert g.delta == pytest.approx(0.05)

    def test_floating_point_thirds_within_default_epsilon(self):
        # 0.333 + 0.333 + 0.334 = 1.000 exactly, so this is the easy case.
        # The real edge: 1/3 each, where Python's float gives 0.9999999...
        result = validate_share_sum(_rows(
            (1, "CN-1", 2025, 1 / 3),
            (2, "CN-1", 2025, 1 / 3),
            (3, "CN-1", 2025, 1 / 3),
        ))
        assert result.ok, f"failed groups: {result.failed}"

    def test_decimal_input_is_accepted(self):
        result = validate_share_sum(_rows(
            (1, "CN-1", 2025, Decimal("0.5")),
            (2, "CN-1", 2025, Decimal("0.5")),
        ))
        assert result.ok

    def test_groups_are_separated_by_year(self):
        # Same cover note, two underwriting years — each must sum to 1.0
        # independently. If the validator collapsed them it would see sum = 2.0.
        result = validate_share_sum(_rows(
            (1, "CN-1", 2024, 0.60),
            (2, "CN-1", 2024, 0.40),
            (3, "CN-1", 2025, 0.70),
            (4, "CN-1", 2025, 0.30),
        ))
        assert result.ok
        assert len(result.groups) == 2

    def test_groups_are_separated_by_cover_note(self):
        result = validate_share_sum(_rows(
            (1, "CN-1", 2025, 0.50),
            (2, "CN-2", 2025, 0.50),  # different placement
        ))
        # Both groups are individually short of 1.0
        assert not result.ok
        assert len(result.failed) == 2

    def test_zero_or_negative_shares_are_skipped(self):
        # The placeholder rows (no reinsurer assigned yet) must not pull the
        # sum down. Only paying-in rows count.
        result = validate_share_sum(_rows(
            (1, "CN-1", 2025, 1.0),
            (2, "CN-1", 2025, 0.0),
            (3, "CN-1", 2025, None),
        ))
        assert result.ok

    def test_rows_without_cover_note_are_skipped(self):
        # Bare Contract rows (e.g. orphan import lines) shouldn't form a group.
        result = validate_share_sum(_rows(
            (1, None, 2025, 0.5),
            (2, "", 2025, 0.5),
        ))
        assert result.ok
        assert result.groups == ()

    def test_empty_input_is_ok(self):
        assert validate_share_sum([]).ok

    def test_epsilon_can_be_tightened(self):
        rows = _rows(
            (1, "CN-1", 2025, 0.4999),
            (2, "CN-1", 2025, 0.5),
        )
        # Default epsilon = 1e-4 → 0.0001 drift is on the boundary; tightening
        # to 1e-6 must reject it.
        assert validate_share_sum(rows, epsilon=DEFAULT_EPSILON).ok
        assert not validate_share_sum(rows, epsilon=1e-6).ok


class TestAssertShareSum:
    def test_passes_silently_when_clean(self):
        result = assert_share_sum(_rows(
            (1, "CN-1", 2025, 0.5),
            (2, "CN-1", 2025, 0.5),
        ))
        assert result.ok

    def test_raises_with_failing_groups_attached(self):
        with pytest.raises(ShareSumError) as ei:
            assert_share_sum(_rows(
                (1, "CN-1", 2025, 0.6),
                (2, "CN-1", 2025, 0.5),
            ))
        assert ei.value.result.failed[0].delta == pytest.approx(0.1)
        assert "CN-1" in str(ei.value)


class TestSoftCheckForFallback:
    def test_clean_group_returns_all_rows_no_warnings(self):
        rows = _rows(
            (1, "CN-1", 2025, 0.5),
            (2, "CN-1", 2025, 0.5),
        )
        chosen, warnings = soft_check_for_fallback(rows)
        assert [c.id for c in chosen] == [1, 2]
        assert warnings == []

    def test_picks_only_valid_year_when_one_year_is_clean(self):
        # Real-world shape: contracts table has both 2024 (clean) and 2025
        # (incomplete) rows under the same cover_note_no. Fallback must
        # collapse to the clean year and warn that it ignored the others.
        rows = _rows(
            (1, "CN-1", 2024, 0.5),
            (2, "CN-1", 2024, 0.5),
            (3, "CN-1", 2025, 0.4),
        )
        chosen, warnings = soft_check_for_fallback(rows)
        assert sorted(c.id for c in chosen) == [1, 2]
        codes = [w["code"] for w in warnings]
        assert "share_sum_mismatch" in codes
        assert "multi_year_collapsed" in codes

    def test_no_valid_group_returns_all_rows_with_warnings(self):
        rows = _rows(
            (1, "CN-1", 2025, 0.4),
            (2, "CN-1", 2025, 0.4),
        )
        chosen, warnings = soft_check_for_fallback(rows)
        assert [c.id for c in chosen] == [1, 2]
        assert any(w["code"] == "share_sum_mismatch" for w in warnings)
        # No collapse warning when there's nothing valid to collapse to.
        assert not any(w["code"] == "multi_year_collapsed" for w in warnings)

    def test_warning_payload_shape_is_stable(self):
        # The frontend / SSE consumer relies on these keys.
        rows = _rows(
            (1, "CN-1", 2025, 0.4),
            (2, "CN-1", 2025, 0.5),
        )
        _, warnings = soft_check_for_fallback(rows)
        w = next(w for w in warnings if w["code"] == "share_sum_mismatch")
        assert set(w.keys()) == {"code", "cover_note_no", "year", "expected", "actual", "delta"}
        assert w["expected"] == 1.0
        assert w["actual"] == pytest.approx(0.9)
        assert w["delta"] == pytest.approx(-0.1)
