"""Tests for the slip_cases ↔ bordereau reconciliation logic.

Drives :func:`scripts.audit_slip_cases_keys.reconcile` with synthetic
``slip_cases`` rows and a synthetic bordereau-derived
:class:`SOCHistory`. Verifies the three-way classification (both /
bordereau-only / slip-only) under each plausible mismatch pattern.
"""

from __future__ import annotations

import pytest

from app.services.parsers.kb import (
    DAEWOO_RECIPIENT,
    DEFAULT_INS_RECIPIENT,
    SOCHistory,
)
from app.services.parsers.kb.slip_cases_sync import reconcile
from app.services.parsers.kb_bordereau import SHEET_KIND_SOC

from ._builders import make_result, make_row


# ─── Helpers ───────────────────────────────────────────────────────────────


def _slip_case_with_ref(
    case_id: str,
    refs: list[str],
    *,
    cedant: str = "KB",
    daewoo: bool = False,
) -> dict:
    return {
        "id": case_id,
        "extracted": {
            "cedant": cedant,
            "claims": [{"cedant_ref_no": r} for r in refs],
        },
        "input_files": [
            {"name": (
                "PLA_FAC_INS(DAEWOO)_2026.02.pdf"
                if daewoo
                else "KB SOC INS Feb 2026.pdf"
            )}
        ],
    }


def _bordereau_history_with_ref(
    ref: str,
    *,
    revision: int,
    casualty: str = "박*배",
    recipient: str = DEFAULT_INS_RECIPIENT,
) -> SOCHistory:
    """Build a :class:`SOCHistory` containing one bordereau SOC row."""
    history = SOCHistory()
    soc = make_result(
        [
            make_row(
                ref=ref,
                revision=revision,
                casualty=casualty,
                recipient=recipient,
                sheet_kind=SHEET_KIND_SOC,
            ),
        ],
        sheet_kind=SHEET_KIND_SOC,
        recipient=recipient,
    )
    history.add(soc)
    return history


# ─── Reconciliation scenarios ──────────────────────────────────────────────


class TestReconcile:
    def test_both_tiers_agree(self):
        """slip_cases and bordereau both record the same ref →
        ``ref_level_both`` contains it; the other two buckets are empty."""
        slip_rows = [_slip_case_with_ref("c1", ["2024-1105009358 001"])]
        history = _bordereau_history_with_ref("20241105009358", revision=1)

        rec = reconcile(slip_rows, history)
        ref_pair = (DEFAULT_INS_RECIPIENT, "2024-1105009358")

        assert ref_pair in rec["ref_level_both"]
        assert ref_pair not in rec["ref_level_bordereau_only"]
        assert ref_pair not in rec["ref_level_slip_only"]

    def test_bordereau_only_when_slip_cases_silent(self):
        """A claim that the monthly bordereau records but the live
        slip_cases pipeline never produced — common backfill gap."""
        slip_rows: list[dict] = []
        history = _bordereau_history_with_ref("20241105009358", revision=1)

        rec = reconcile(slip_rows, history)
        ref_pair = (DEFAULT_INS_RECIPIENT, "2024-1105009358")

        assert ref_pair in rec["ref_level_bordereau_only"]
        assert ref_pair not in rec["ref_level_slip_only"]
        assert ref_pair not in rec["ref_level_both"]

    def test_slip_only_is_suspicious(self):
        """slip_cases has a key the bordereau doesn't — hallucinated
        ref or missing bordereau month. Should land in
        ``ref_level_slip_only`` for human review."""
        slip_rows = [_slip_case_with_ref("c1", ["2024-1105009358 001"])]
        history = SOCHistory()  # bordereau empty

        rec = reconcile(slip_rows, history)
        ref_pair = (DEFAULT_INS_RECIPIENT, "2024-1105009358")

        assert ref_pair in rec["ref_level_slip_only"]
        assert ref_pair not in rec["ref_level_both"]
        assert ref_pair not in rec["ref_level_bordereau_only"]

    def test_recipient_mismatch_treated_as_separate_refs(self):
        """A slip_case with DAEWOO marker should not match an INS-side
        bordereau key — the recipient is part of the ref-level tuple."""
        slip_rows = [
            _slip_case_with_ref("c1", ["2024-1105009358 001"], daewoo=True),
        ]
        history = _bordereau_history_with_ref(
            "20241105009358", revision=1, recipient=DEFAULT_INS_RECIPIENT,
        )

        rec = reconcile(slip_rows, history)
        # Two distinct (recipient, ref) pairs — neither is in 'both'.
        assert (DAEWOO_RECIPIENT, "2024-1105009358") in rec["ref_level_slip_only"]
        assert (DEFAULT_INS_RECIPIENT, "2024-1105009358") in rec["ref_level_bordereau_only"]
        assert rec["ref_level_both"] == []

    def test_quality_breakdown_reported(self):
        slip_rows = [
            _slip_case_with_ref("c1", ["2024-1105009358 001"]),       # partial
            _slip_case_with_ref("c2", ["2024-1105009358"]),           # inferred (no rev)
        ]
        rec = reconcile(slip_rows, SOCHistory())
        breakdown = rec["sync_report"]["quality_breakdown"]
        assert breakdown["partial"] >= 1
        assert breakdown["inferred"] >= 1

    def test_per_row_extraction_carried_in_audit_payload(self):
        slip_rows = [_slip_case_with_ref("c1", ["2024-1105009358 001"])]
        rec = reconcile(slip_rows, SOCHistory())
        per_row = rec["per_row_keys"]
        assert len(per_row) == 1
        assert per_row[0]["slip_case_id"] == "c1"
        assert len(per_row[0]["extracted"]) == 1
        assert per_row[0]["extracted"][0]["ref_body"] == "2024-1105009358"

    def test_skipped_reasons_propagated_to_audit_payload(self):
        # A non-KB row should generate a skip reason that lands in the
        # report.
        slip_rows = [
            {
                "id": "non-kb",
                "extracted": {"cedant": "HW"},
                "input_files": [],
            },
        ]
        rec = reconcile(slip_rows, SOCHistory())
        skipped = rec["sync_report"]["skipped"]
        assert any("non-KB cedant" in s["reason"] for s in skipped)
