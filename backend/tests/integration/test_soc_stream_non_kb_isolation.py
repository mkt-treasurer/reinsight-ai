"""Non-KB inputs must take the legacy code path in *every* mode.

The Phase-3c gate is the cedant detector — anything that doesn't
score above the 0.95 threshold falls through to the LLM-only flow.
These tests pin that behaviour against synthetic inputs that resemble
KR / HW / SS / DB / HM / Meritz documents.
"""

from __future__ import annotations

import warnings
from pathlib import Path

import pytest
from openpyxl import Workbook

from ._helpers import kb_int_module, kb_parser_mode

warnings.filterwarnings("ignore")


def _build_non_kb_xlsx(tmp_path: Path, sheet_name: str, filename: str) -> str:
    """Create a minimal xlsx that doesn't carry KB markers."""
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    # Letterhead-ish content but no 'KB Insurance' / 'KB Ref' / DAEWOO INS
    # tokens. Other cedants use their own header phrases.
    ws.append(["Settlement of Claim"])
    ws.append(["Cedant: Korean Re"])
    ws.append([])
    ws.append([
        "Claim Number", "Insured", "Loss Date", "Amount", "Currency",
    ])
    ws.append(["KR-2026-0001", "Sample Insured", "2026-01-15", 1000000, "WON"])
    target = tmp_path / filename
    wb.save(target)
    return str(target)


class TestNonKbIsolation:
    @pytest.mark.parametrize("mode,approved", [
        ("off", None),
        ("shadow", None),
        ("on", "phase-3d-review-001"),
    ])
    def test_non_kb_xlsx_falls_through_in_every_mode(self, tmp_path, mode, approved):
        with kb_parser_mode(mode, approved=approved):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            path = _build_non_kb_xlsx(tmp_path, "Sheet1", "korean_re_soc.xlsx")
            result = kb_int.try_parse_kb_xlsx(ctx, path, "korean_re_soc.xlsx")
            assert result is None, (
                f"non-KB xlsx false-positively triggered KB path in {mode}"
            )
            # No parse happened.
            assert ctx.parsed_results == {}

    def test_hw_xlsx_with_os_list_sheet_falls_back(self, tmp_path):
        """HW could conceivably reuse the 'OS List' sheet name; the
        detector must still refuse without further KB-specific
        signals."""
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            # Sheet name is the only KB signal; no header text, no KB
            # marker in filename — confidence stays at 0.6 < 0.95.
            path = _build_non_kb_xlsx(tmp_path, "OS List", "hw_outstanding.xlsx")
            result = kb_int.try_parse_kb_xlsx(ctx, path, "hw_outstanding.xlsx")
            assert result is None
            # The detector logs the below-threshold hint as audit.
            below_threshold = [
                e for e in ctx.audit_events
                if e["event"] == "cedant_detector_below_threshold"
            ]
            assert len(below_threshold) == 1

    def test_filename_with_kb_alone_is_not_enough(self, tmp_path):
        """``KB`` substring in filename without sheet/header
        corroboration scores 0.7 — below the 0.95 auto threshold."""
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            path = _build_non_kb_xlsx(tmp_path, "RandomSheet", "claim_KB_export.xlsx")
            result = kb_int.try_parse_kb_xlsx(ctx, path, "claim_KB_export.xlsx")
            assert result is None
            assert ctx.parsed_results == {}

    @pytest.mark.parametrize("filename", [
        "Korean Re-FAC SOC 16th.xlsx",
        "SamSungFire_oz_20260304.xlsx",
        "HM SOC_KYOUNGDONG.xlsx",
        "Meritz_8TH_XOL.xlsx",
    ])
    def test_other_cedant_filenames_never_match_kb(self, tmp_path, filename):
        """Cross-cedant filename samples observed in production must
        not false-positively trigger KB."""
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            path = _build_non_kb_xlsx(tmp_path, "Sheet1", filename)
            result = kb_int.try_parse_kb_xlsx(ctx, path, filename)
            assert result is None, (
                f"{filename} false-positively triggered the KB path"
            )

    def test_evidence_payload_unchanged_when_no_kb_files(self, tmp_path):
        """No KB files in this stream → ON-mode evidence_payload still
        carries kb_audit (mode==on) but with empty cross_checks and
        no parsed results."""
        with kb_parser_mode("on", approved="phase-3d-review-001"):
            kb_int = kb_int_module()
            ctx = kb_int.init_kb_integration()
            path = _build_non_kb_xlsx(tmp_path, "Sheet1", "kr_soc.xlsx")
            kb_int.try_parse_kb_xlsx(ctx, path, "kr_soc.xlsx")
            kb_int.run_kb_cross_checks(ctx, {"claims": []})

            payload: dict = {"existing": "data"}
            kb_int.finalize_kb_integration(ctx, payload)
            # Existing keys preserved; kb_audit added (active mode).
            assert payload["existing"] == "data"
            assert payload["kb_audit"]["mode"] == "on"
            # No parsed result → no cross-check.
            assert payload["kb_audit"]["cross_checks"] == []
