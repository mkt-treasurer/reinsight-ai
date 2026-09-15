"""Tests for :func:`cross_check`.

The Phase-3c policy table (Step 1 보고) maps each disagreement type
to a severity. These tests pin that mapping so the audit pipeline
keeps producing the same severity bands as live data drifts.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.parsers.kb import (
    SEVERITY_FAIL,
    SEVERITY_INFO,
    SEVERITY_OK,
    SEVERITY_WARNING,
    cross_check,
)
from app.services.parsers.kb_bordereau import KBBordereauResult, SHEET_KIND_PLA

from ._builders import make_result, make_row


# ─── Helpers ───────────────────────────────────────────────────────────────


def _det_with_one_row(
    *,
    ref: str = "20260204009404",
    revision: int = 1,
    claim: Decimal = Decimal("10000000"),
    expense: Decimal = Decimal("500000"),
    casualty: str = "박*배",
) -> KBBordereauResult:
    rows = [
        make_row(
            ref=ref, revision=revision, casualty=casualty,
            amounts={
                "os_loss_indemnity": claim,
                "os_loss_others": Decimal("0"),
                "os_expense": expense,
            },
        ),
    ]
    result = make_result(rows)
    # Fill totals_by_currency the way kb_bordereau would.
    result.totals_by_currency = {
        "WON": {
            "os_loss_indemnity": claim,
            "os_loss_others": Decimal("0"),
            "os_expense": expense,
        },
    }
    return result


def _llm_with_one_claim(
    *,
    ref: str = "2024-1105009358 001",
    claim: float = 10_000_000,
    expense: float = 500_000,
    currency: str = "WON",
) -> dict:
    return {
        "claims": [
            {
                "cedant_ref_no": ref,
                "claim_amount_100": claim,
                "expense_100": expense,
                "currency": currency,
            }
        ],
    }


# ─── Severity mapping ──────────────────────────────────────────────────────


class TestSeverityMapping:
    def test_perfect_agreement_returns_ok(self):
        det = _det_with_one_row(ref="20260204009404", revision=1)
        llm = _llm_with_one_claim(ref="2026-0204009404 001")
        r = cross_check(det, llm)
        # Perfect except for the casualty info note (LLM has no casualty).
        # That's an INFO, not a fail/warning.
        assert r.severity in (SEVERITY_OK, SEVERITY_INFO)
        assert r.epsilon_violated is False
        assert r.deterministic_row_count == 1
        assert r.llm_row_count == 1

    def test_row_count_mismatch_is_fail(self):
        det = _det_with_one_row()
        llm = {"claims": [_llm_with_one_claim()["claims"][0]] * 2}  # 2 rows on LLM
        r = cross_check(det, llm)
        assert r.severity == SEVERITY_FAIL
        assert any(
            d["check"] == "row_count" and d["severity"] == SEVERITY_FAIL
            for d in r.mismatch_details
        )

    def test_currency_total_off_by_more_than_1pct_is_fail(self):
        det = _det_with_one_row(claim=Decimal("10000000"))
        llm = _llm_with_one_claim(claim=10_500_000)  # 5% off
        r = cross_check(det, llm)
        assert r.epsilon_violated is True
        assert r.severity == SEVERITY_FAIL

    def test_currency_total_off_by_less_than_1pct_is_warning(self):
        det = _det_with_one_row(claim=Decimal("10000000"))
        llm = _llm_with_one_claim(claim=10_000_500)  # 0.005% off
        r = cross_check(det, llm)
        assert r.epsilon_violated is True
        assert r.severity == SEVERITY_WARNING

    def test_ref_set_drift_is_warning(self):
        det = _det_with_one_row(ref="20260204009404", revision=1)
        # Same row count, same totals, but a different ref value.
        llm = _llm_with_one_claim(ref="2024-1105009358 001", claim=10_000_000)
        # Tweak claim amount equal so totals match but refs don't.
        r = cross_check(det, llm)
        # Currency totals match exactly so totals check is OK; ref-set
        # drift bumps to warning.
        assert any(
            d["check"] == "ref_set" for d in r.mismatch_details
        )
        assert r.severity in (SEVERITY_WARNING, SEVERITY_FAIL)

    def test_casualty_missing_on_llm_is_info_only(self):
        det = _det_with_one_row()
        llm = _llm_with_one_claim()  # has no 'casualty' field
        r = cross_check(det, llm)
        # The casualty difference is expected (LLM doesn't extract it),
        # so it lands as info — never warning, never fail.
        casualty_details = [d for d in r.mismatch_details if d["check"] == "casualty"]
        assert casualty_details
        assert all(
            d["severity"] == SEVERITY_INFO for d in casualty_details
        )


# ─── Output shape ──────────────────────────────────────────────────────────


class TestOutputShape:
    def test_totals_dicts_carry_per_currency_amounts(self):
        det = _det_with_one_row(claim=Decimal("10000000"), expense=Decimal("500000"))
        llm = _llm_with_one_claim(claim=10_000_000, expense=500_000)
        r = cross_check(det, llm)
        assert r.deterministic_totals.get("WON") == Decimal("10500000")
        assert r.llm_totals.get("WON") == Decimal("10500000")

    def test_empty_llm_response_does_not_crash(self):
        det = _det_with_one_row()
        r = cross_check(det, {})  # no 'claims' key at all
        # Det has one row, LLM has zero — fail.
        assert r.severity == SEVERITY_FAIL
        assert r.llm_row_count == 0

    def test_malformed_llm_claims_array_skipped_safely(self):
        det = _det_with_one_row()
        r = cross_check(det, {"claims": "not-a-list"})
        # Malformed — treat as zero rows.
        assert r.llm_row_count == 0
        assert r.severity == SEVERITY_FAIL
