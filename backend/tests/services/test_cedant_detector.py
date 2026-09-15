"""Tests for the Phase-3c cedant detector.

The detector is the gatekeeper for the deterministic-parser path —
false positives ship a non-KB file into KB-only logic, false negatives
just miss a perf-and-accuracy boost. The bias is firmly toward the
former. These tests pin the threshold behaviour and exercise the
known false-positive risks (filenames containing "KB" but no other
KB markers, sheet names shared across cedants).
"""

from __future__ import annotations

import pytest

from app.services.cedant_detector import CedantHint, detect_cedant


# ─── Tier 1 — definitive header ────────────────────────────────────────────


class TestDefinitiveHeader:
    def test_kb_ref_header_alone_is_enough(self):
        # Only the column header is fed in — no sheet names, no
        # filename hints. Should still fire at confidence 1.0.
        hint = detect_cedant(
            file_path="/tmp/anything.xlsx",
            sheet_names=None,
            header_text="상품명 증권번호 접수번호\n(KB Ref) 사고일자",
        )
        assert hint.cedant == "KB"
        assert hint.confidence >= 1.0
        assert hint.decision == "auto"
        assert "kb_ref_header" in hint.signals

    def test_partial_kb_ref_does_not_match(self):
        # Only "KB Ref" without "접수번호" — too weak. Other cedants
        # could conceivably reuse this English label.
        hint = detect_cedant(
            file_path="/tmp/x.xlsx",
            sheet_names=None,
            header_text="something KB Ref something",
        )
        assert hint.cedant is None
        assert hint.decision == "fallback"


# ─── Tier 2 — sheet name + corroboration ───────────────────────────────────


class TestSheetWithCorroboration:
    def test_sheet_plus_letterhead_yields_auto(self):
        hint = detect_cedant(
            file_path="/tmp/some_file.xlsx",
            sheet_names=["OS List"],
            header_text="To: 인스보험중개, SEOUL, KOREA — letterhead — KB Insurance",
        )
        # 0.99 from sheet+letterhead, 0.98 from sheet+recipient combine
        # (max wins), so the final is 0.99 — auto tier.
        assert hint.cedant == "KB"
        assert hint.decision == "auto"
        assert hint.confidence >= 0.98

    def test_sheet_plus_recipient_yields_auto(self):
        hint = detect_cedant(
            file_path="/tmp/some_file.xlsx",
            sheet_names=["SOC"],
            header_text="To: DAEWOO INS — body",
        )
        assert hint.cedant == "KB"
        assert hint.decision == "auto"
        assert hint.confidence >= 0.98


# ─── Tier 3 — borderline (auto_with_audit) ─────────────────────────────────


class TestBorderline:
    def test_sheet_plus_filename_kb_is_borderline(self):
        # sheet only matches OS List, filename has "KB". No letterhead /
        # recipient text given. Confidence sits at 0.97 → audit tier.
        hint = detect_cedant(
            file_path="/tmp/KB_export_2026.xlsx",
            sheet_names=["OS List"],
            header_text="anonymous header without kb-specific tokens",
        )
        assert hint.cedant == "KB"
        assert hint.decision == "auto_with_audit"
        assert 0.95 <= hint.confidence < 0.98
        assert "kb_sheet+filename_kb" in hint.signals

    def test_sheet_plus_filename_fac_ins_is_borderline(self):
        hint = detect_cedant(
            file_path="/tmp/FAC_INS_2026.02.xlsx",
            sheet_names=["OS List"],
            header_text="something",
        )
        assert hint.cedant == "KB"
        assert hint.decision == "auto_with_audit"


# ─── Fallback — false-positive guards ──────────────────────────────────────


class TestFallback:
    def test_sheet_only_falls_back(self):
        hint = detect_cedant(
            file_path="/tmp/something.xlsx",
            sheet_names=["OS List"],
            header_text=None,
        )
        # Sheet name alone is too weak — other cedants could reuse it.
        assert hint.cedant is None
        assert hint.decision == "fallback"
        assert hint.confidence < 0.95

    def test_filename_only_falls_back(self):
        hint = detect_cedant(
            file_path="/tmp/KB_something.xlsx",
            sheet_names=None,
            header_text=None,
        )
        # Filename alone gets only 0.7 — explicit policy decision.
        assert hint.cedant is None
        assert hint.decision == "fallback"

    @pytest.mark.parametrize("path,sheets", [
        ("/tmp/Korean Re-FAC SOC.xlsx", ["Sheet1"]),
        ("/tmp/SamSungFire_oz_20260304.xlsx", ["Settlement"]),
        ("/tmp/HM SOC_KYOUNGDONG.xlsx", ["Sheet1"]),
        ("/tmp/Meritz_8TH_XOL.xlsx", None),
        ("/tmp/HW_(주)한화_CGL.xlsx", ["Loss"]),
    ])
    def test_other_cedant_filenames_do_not_match_kb(self, path, sheets):
        """Cross-cedant filenames must never resolve to KB."""
        hint = detect_cedant(
            file_path=path,
            sheet_names=sheets,
            header_text=None,
        )
        assert hint.cedant is None, (
            f"{path} false-positively flagged as KB "
            f"(confidence={hint.confidence}, signals={hint.signals})"
        )

    def test_no_signals_returns_zero_confidence(self):
        hint = detect_cedant("/tmp/x.xlsx", sheet_names=[], header_text="")
        assert hint.cedant is None
        assert hint.confidence == 0.0
        assert hint.signals == ()


# ─── Real fixtures ─────────────────────────────────────────────────────────


class TestRealFixtures:
    @pytest.fixture
    def kb_pla_path(self):
        from pathlib import Path
        # parents[0]=services, parents[1]=tests, parents[2]=backend.
        # Fixtures live at backend/tests/fixtures/...
        return str(
            Path(__file__).resolve().parents[1]
            / "fixtures" / "kb_borderau" / "PLA_FAC_INS_2026.02.xlsx"
        )

    def test_real_kb_pla_fixture_detected(self, kb_pla_path):
        from openpyxl import load_workbook
        import warnings
        warnings.filterwarnings("ignore")
        wb = load_workbook(kb_pla_path, data_only=True, read_only=True)
        sheet_names = list(wb.sheetnames)
        ws = wb[sheet_names[0]]
        # Concat first 25 rows worth of cell text — what the integration
        # point will pass in.
        header_text_parts = []
        for r in range(1, min(26, ws.max_row + 1)):
            for cell in ws[r]:
                if cell.value:
                    header_text_parts.append(str(cell.value))
        header_text = " ".join(header_text_parts)
        wb.close()

        hint = detect_cedant(kb_pla_path, sheet_names=sheet_names, header_text=header_text)
        assert hint.cedant == "KB"
        assert hint.decision == "auto"
        assert hint.confidence >= 0.98
