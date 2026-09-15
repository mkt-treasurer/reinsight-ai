"""Test helpers for in-memory construction of KB parser outputs.

Phase-2 unit tests don't go through openpyxl; they build
:class:`KBClaimRow` and :class:`KBBordereauResult` instances directly
so each test exercises one slice of the diff engine without a full
xlsx round-trip. The integration / scenario tests under
``test_monthly_diff_scenarios.py`` use real xlsx fixtures instead.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from app.services.parsers.kb_bordereau import (
    SHEET_KIND_PLA,
    SHEET_KIND_SOC,
    KBBordereauResult,
    KBClaimRow,
)
from app.services.parsers.ref_no_parser import parse_kb_ref_no


INS_RECIPIENT = "인스보험중개, SEOUL, KOREA"
DAEWOO_RECIPIENT = "DAEWOO INS"


def make_row(
    *,
    recipient: str = INS_RECIPIENT,
    ref: str = "20260101000001",
    revision: int = 0,
    casualty: Optional[str] = "victim",
    item_serial: Optional[int] = 1,
    cession_serial: Optional[int] = 1,
    sheet_kind: str = SHEET_KIND_PLA,
    row_index: int = 13,
    insured: str = "Test Insured",
    **overrides: Any,
) -> KBClaimRow:
    """Build a fully-populated :class:`KBClaimRow` for tests.

    The defaults are deliberately innocuous; pass overrides to exercise
    a specific field's behaviour. ``ref`` is fed through the real
    :func:`parse_kb_ref_no` so the resulting ``ref_no.key`` matches
    what production code would compute.
    """
    parsed = parse_kb_ref_no(ref, revision=revision)
    base = dict(
        sheet_kind=sheet_kind,
        recipient=recipient,
        row_index=row_index,
        ref_no=parsed,
        insured=insured,
        policy_no="P-TEST",
        lob="Test LoB",
        inception=date(2024, 1, 1),
        expiry=date(2025, 1, 1),
        dol=date(2024, 6, 1),
        doc=date(2024, 6, 5),
        revision=revision,
        casualty=casualty,
        item_serial=item_serial,
        cession_serial=cession_serial,
        loss_description="test loss",
    )
    base.update(overrides)
    return KBClaimRow(**base)


def make_result(
    rows: list[KBClaimRow],
    *,
    sheet_kind: str = SHEET_KIND_PLA,
    recipient: str = INS_RECIPIENT,
    file_name: str = "test.xlsx",
) -> KBBordereauResult:
    """Wrap rows in a :class:`KBBordereauResult` envelope."""
    sheet_name = "OS List" if sheet_kind == SHEET_KIND_PLA else "SOC"
    return KBBordereauResult(
        file_name=file_name,
        sheet_kind=sheet_kind,
        sheet_name=sheet_name,
        recipient=recipient,
        rows=rows,
        totals_by_currency={},
        warnings=[],
        skipped_sheets=[],
    )
