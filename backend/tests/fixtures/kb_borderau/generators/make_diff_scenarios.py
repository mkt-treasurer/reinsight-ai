"""Generate the 3-month synthetic KB bordereau set used by
``test_monthly_diff_scenarios``.

Real KB fixtures are PII-sensitive and we ship only one month of
production data, so multi-month diff scenarios need synthetic xlsx
files. The output of this generator is committed to git under
``tests/fixtures/kb_borderau/synthetic/`` — re-run when scenarios
change, then commit the regenerated files.

Each scenario claim is anchored to a specific :class:`TransitionType`
so the resulting expectations in the test file map cleanly back to
the producing claim. See ``SCENARIOS`` below for the full ledger.

Usage::

    cd backend && python -m tests.fixtures.kb_borderau.generators.make_diff_scenarios
"""

from __future__ import annotations

import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

from openpyxl import Workbook


# ─── Header layouts (mirror the real KB headers from Phase 1) ──────────────


PLA_HEADER = [
    None,
    "상품명\n(LoB)",
    "증권번호 \n(Policy No)",
    "계약자명\n(Insured)",
    "보험개시일\n(Inception)",
    "보험종료일\n(Expiry)",
    "접수번호\n(KB Ref)",
    "사고일자\n(DOL)",
    "배상청구일자\n(DOC)",
    "사고내용\n(Loss Description)",
    "재해명\n(Casualty)",
    "추산일자\n(OS Date)",
    "추산차수\n(OS Serial)",
    "목적물번호\n(Item Serial)",
    "출재단위번호\n(Cession Serial)",
    "담보코드\n(Coverage Code)",
    "화폐\n(Currency_Claim)",
    "화폐\n(Currency_Expense)",
    "원보험금\n(OS Loss_Indemnity)",
    "원보험금_기타\n(OS Loss_Others)",
    "원 손해조사비\n(OS Expense)",
    "출재율(%)\nYour Share(%)",
    "재보험금\n(Ceded OS Loss_Indemnity)",
    "재보험금_기타\n(Ceded OS Loss_Others)",
    "출재 손해조사비\n(Ceded OS Expense)",
]

SOC_HEADER = [
    None,
    "상품명\n(LoB)",
    "증권번호 \n(Policy No)",
    "계약자명\n(Insured)",
    "보험개시일\n(Inception)",
    "보험종료일\n(Expiry)",
    "접수번호\n(KB Ref)",
    "사고일자\n(DOL)",
    "배상청구일자\n(DOC)",
    "사고내용\n(Loss Description)",
    "재해명\n(Casualty)",
    "결정일자\n(Paid Date)",
    "결정차수\n(Paid Serial)",
    "목적물번호\n(Item Serial)",
    "출재단위번호\n(Cession Serial)",
    "담보코드\n(Coverage Code)",
    "화폐\n(Currency_Claim)",
    "화폐\n(Currency_Expense)",
    "개별SOC발송일자\n(Separate SOC Date)",
    "원수보험금\n(Paid Loss_Indemnity)",
    "원수보험금_기타\n(Paid Loss_Others)",
    "원수손해조사비\n(Paid Expense)",
    "출재율(%)\nYour Share(%)",
    "출재보험금\n(Ceded Paid Loss_Indemnity)",
    "출재보험금_기타\n(Ceded Paid Loss_Others)",
    "출재손해조사비\n(Ceded Paid Expense)",
]


def _data_row_pla(
    *,
    insured: str,
    policy_no: str,
    inception: date,
    expiry: date,
    ref_no: str,
    dol: date,
    doc: date,
    loss_desc: str,
    casualty: str,
    os_date: date,
    revision: int,
    item_serial: int = 1,
    cession_serial: int = 1,
    coverage: str = "GLC011",
    currency: str = "WON",
    os_loss: float = 1_000_000,
    os_others: float = 0,
    os_expense: float = 100_000,
    share_pct: float = 10,
    ceded_os_loss: Optional[float] = None,
    ceded_os_others: float = 0,
    ceded_os_expense: Optional[float] = None,
    lob: str = "Test Liability",
) -> list[Any]:
    if ceded_os_loss is None:
        ceded_os_loss = os_loss * share_pct / 100
    if ceded_os_expense is None:
        ceded_os_expense = os_expense * share_pct / 100
    return [
        None,
        lob, policy_no, insured,
        datetime.combine(inception, datetime.min.time()),
        datetime.combine(expiry, datetime.min.time()),
        ref_no,
        datetime.combine(dol, datetime.min.time()),
        datetime.combine(doc, datetime.min.time()),
        loss_desc, casualty,
        datetime.combine(os_date, datetime.min.time()),
        revision, item_serial, cession_serial,
        coverage, currency, currency,
        os_loss, os_others, os_expense,
        share_pct, ceded_os_loss, ceded_os_others, ceded_os_expense,
    ]


def _data_row_soc(
    *,
    insured: str,
    policy_no: str,
    inception: date,
    expiry: date,
    ref_no: str,
    dol: date,
    doc: date,
    loss_desc: str,
    casualty: str,
    paid_date: date,
    revision: int,
    item_serial: int = 1,
    cession_serial: int = 1,
    coverage: str = "GLC011",
    currency: str = "WON",
    paid_loss: float = 1_000_000,
    paid_others: float = 0,
    paid_expense: float = 100_000,
    share_pct: float = 10,
    ceded_paid_loss: Optional[float] = None,
    ceded_paid_others: float = 0,
    ceded_paid_expense: Optional[float] = None,
    lob: str = "Test Liability",
) -> list[Any]:
    if ceded_paid_loss is None:
        ceded_paid_loss = paid_loss * share_pct / 100
    if ceded_paid_expense is None:
        ceded_paid_expense = paid_expense * share_pct / 100
    return [
        None,
        lob, policy_no, insured,
        datetime.combine(inception, datetime.min.time()),
        datetime.combine(expiry, datetime.min.time()),
        ref_no,
        datetime.combine(dol, datetime.min.time()),
        datetime.combine(doc, datetime.min.time()),
        loss_desc, casualty,
        datetime.combine(paid_date, datetime.min.time()),
        revision, item_serial, cession_serial,
        coverage, currency, currency,
        "(비어 있음)",
        paid_loss, paid_others, paid_expense,
        share_pct, ceded_paid_loss, ceded_paid_others, ceded_paid_expense,
    ]


def _build_workbook(
    *,
    sheet_name: str,
    recipient: str,
    header: list[Any],
    data_rows: list[list[Any]],
) -> Workbook:
    """Build a KB-shaped workbook with the standard letterhead +
    header layout (header on row 12, data starting row 13)."""
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name

    for _ in range(9):
        ws.append([None])
    ws.append([None, "To :", recipient])
    ws.append([None])
    ws.append(header)
    for r in data_rows:
        ws.append(r)

    # Per-currency Total row mimicking the production format. We only
    # write a WON total since synthetic data is single-currency.
    if data_rows:
        # Compute the per-amount-column totals from the data rows.
        # PLA amounts at cols 19-25; SOC amounts at cols 20-26.
        if sheet_name == "OS List":
            amount_cols = (19, 20, 21, 23, 24, 25)
            label_col = 17
        else:
            amount_cols = (20, 21, 22, 24, 25, 26)
            label_col = 18
        totals = [0.0] * len(amount_cols)
        for r in data_rows:
            for i, c in enumerate(amount_cols):
                v = r[c - 1]
                if isinstance(v, (int, float)):
                    totals[i] += v
        total_row: list[Any] = [None] * 28
        total_row[label_col - 1] = "Total"
        total_row[label_col] = "WON"  # currency just after Total label
        for i, c in enumerate(amount_cols):
            total_row[c - 1] = totals[i]
        ws.append(total_row)

    return wb


# ─── Scenario ledger ───────────────────────────────────────────────────────


# Three months of synthetic data designed to exercise every
# TransitionType. Each claim is anchored by a stable ref_no so test
# code can spot-check transitions by ref.
SCENARIO_REFS = {
    "C1_unchanged":         "20260101000001",
    "C2_revision_bump":     "20260101000002",
    "C3_revision_gap":      "20260101000003",
    "C4_revision_regress":  "20260101000004",
    "C5_settled":           "20260101000005",
    "C6_dismissed":         "20260101000006",
    "C7_new":               "20260102000007",   # appears in M2 only
    "C8_reopened":          "20260101000008",   # M1 PLA + SOC, M2 absent, M3 returns
    "C9_sibling_personal":  "20260101000009",
    "C9_sibling_property":  "20260101000009",   # same ref, casualty differs
    "C10_drift_misang":     "20260101000010",   # casualty '미상' in M1
    "C10_drift_named":      "20260101000010",   # casualty '김*숙' in M2
}


def _common_kwargs(ref: str, casualty: str, revision: int) -> dict[str, Any]:
    return dict(
        insured="합성투어(주)",
        policy_no="20240000001",
        inception=date(2024, 1, 1),
        expiry=date(2025, 1, 1),
        ref_no=ref,
        dol=date(2024, 6, 1),
        doc=date(2024, 6, 5),
        loss_desc="합성 사고",
        casualty=casualty,
        revision=revision,
    )


def make_month_1_pla() -> Workbook:
    """Month 1 PLA INS: baseline with 8 claims (sets up M1→M2 diff)."""
    rows = [
        _data_row_pla(os_date=date(2026, 1, 10), **_common_kwargs(SCENARIO_REFS["C1_unchanged"],        "C1 인수자",      0)),
        _data_row_pla(os_date=date(2026, 1, 10), **_common_kwargs(SCENARIO_REFS["C2_revision_bump"],    "C2 인수자",      0)),
        _data_row_pla(os_date=date(2026, 1, 10), **_common_kwargs(SCENARIO_REFS["C3_revision_gap"],     "C3 인수자",      0)),
        _data_row_pla(os_date=date(2026, 1, 10), **_common_kwargs(SCENARIO_REFS["C4_revision_regress"], "C4 인수자",      2)),
        _data_row_pla(os_date=date(2026, 1, 10), **_common_kwargs(SCENARIO_REFS["C5_settled"],          "C5 인수자",      1)),
        _data_row_pla(os_date=date(2026, 1, 10), **_common_kwargs(SCENARIO_REFS["C6_dismissed"],        "C6 인수자",      0)),
        # C9 sibling pair (same ref, different casualty)
        _data_row_pla(os_date=date(2026, 1, 10), item_serial=1, cession_serial=1,
                      **_common_kwargs(SCENARIO_REFS["C9_sibling_personal"], "인001 미상", 0)),
        _data_row_pla(os_date=date(2026, 1, 10), item_serial=1, cession_serial=1,
                      **_common_kwargs(SCENARIO_REFS["C9_sibling_property"], "물001 미상", 0)),
        # C10 drift candidate: starts as '미상'
        _data_row_pla(os_date=date(2026, 1, 10),
                      **_common_kwargs(SCENARIO_REFS["C10_drift_misang"], "미상", 0)),
    ]
    return _build_workbook(
        sheet_name="OS List",
        recipient="인스보험중개, SEOUL, KOREA",
        header=PLA_HEADER,
        data_rows=rows,
    )


def make_month_1_soc() -> Workbook:
    """Month 1 SOC INS: includes C8 (later REOPENED)."""
    rows = [
        _data_row_soc(paid_date=date(2026, 1, 25),
                      **_common_kwargs(SCENARIO_REFS["C8_reopened"], "C8 인수자", 0)),
    ]
    return _build_workbook(
        sheet_name="SOC",
        recipient="인스보험중개, SEOUL, KOREA",
        header=SOC_HEADER,
        data_rows=rows,
    )


def make_month_2_pla() -> Workbook:
    """Month 2 PLA INS:
    - C1 unchanged (rev 0)
    - C2 rev bump (0 → 1)
    - C3 rev gap (0 → 2, skipping 1)
    - C4 rev regression (2 → 1)
    - C5 disappeared (will be SETTLED via M2 SOC)
    - C6 disappeared (no SOC → DISMISSED)
    - C7 new (no SOC history)
    - C8 still absent
    - C9 sibling pair unchanged
    - C10 casualty drift ('미상' → '김*숙')
    """
    rows = [
        _data_row_pla(os_date=date(2026, 2, 10), **_common_kwargs(SCENARIO_REFS["C1_unchanged"],        "C1 인수자",   0)),
        _data_row_pla(os_date=date(2026, 2, 10), **_common_kwargs(SCENARIO_REFS["C2_revision_bump"],    "C2 인수자",   1)),
        _data_row_pla(os_date=date(2026, 2, 10), **_common_kwargs(SCENARIO_REFS["C3_revision_gap"],     "C3 인수자",   2)),
        _data_row_pla(os_date=date(2026, 2, 10), **_common_kwargs(SCENARIO_REFS["C4_revision_regress"], "C4 인수자",   1)),
        # C5 absent — will be SETTLED via SOC
        # C6 absent — will be DISMISSED
        _data_row_pla(os_date=date(2026, 2, 10), **_common_kwargs(SCENARIO_REFS["C7_new"], "C7 인수자", 0)),
        # C8 still absent
        _data_row_pla(os_date=date(2026, 2, 10), item_serial=1, cession_serial=1,
                      **_common_kwargs(SCENARIO_REFS["C9_sibling_personal"], "인001 미상", 0)),
        _data_row_pla(os_date=date(2026, 2, 10), item_serial=1, cession_serial=1,
                      **_common_kwargs(SCENARIO_REFS["C9_sibling_property"], "물001 미상", 0)),
        # C10 drift: same ref, casualty changes from '미상' → '김*숙'
        _data_row_pla(os_date=date(2026, 2, 10),
                      **_common_kwargs(SCENARIO_REFS["C10_drift_named"], "김*숙", 0)),
    ]
    return _build_workbook(
        sheet_name="OS List",
        recipient="인스보험중개, SEOUL, KOREA",
        header=PLA_HEADER,
        data_rows=rows,
    )


def make_month_2_soc() -> Workbook:
    """Month 2 SOC INS: pays out C5 (so C5 disappears with SOC trail
    → SETTLED rather than DISMISSED)."""
    rows = [
        _data_row_soc(paid_date=date(2026, 2, 20),
                      **_common_kwargs(SCENARIO_REFS["C5_settled"], "C5 인수자", 2)),
    ]
    return _build_workbook(
        sheet_name="SOC",
        recipient="인스보험중개, SEOUL, KOREA",
        header=SOC_HEADER,
        data_rows=rows,
    )


def make_month_3_pla() -> Workbook:
    """Month 3 PLA INS: C8 returns (REOPENED — SOC history from M1)."""
    rows = [
        # C1, C2, C9 sibling pair persist as UNCHANGED to keep the
        # snapshot non-trivial for the M2→M3 diff.
        _data_row_pla(os_date=date(2026, 3, 10), **_common_kwargs(SCENARIO_REFS["C1_unchanged"],     "C1 인수자",   0)),
        _data_row_pla(os_date=date(2026, 3, 10), **_common_kwargs(SCENARIO_REFS["C2_revision_bump"], "C2 인수자",   1)),
        _data_row_pla(os_date=date(2026, 3, 10), **_common_kwargs(SCENARIO_REFS["C8_reopened"],      "C8 인수자",   1)),
        _data_row_pla(os_date=date(2026, 3, 10), item_serial=1, cession_serial=1,
                      **_common_kwargs(SCENARIO_REFS["C9_sibling_personal"], "인001 미상", 0)),
        _data_row_pla(os_date=date(2026, 3, 10), item_serial=1, cession_serial=1,
                      **_common_kwargs(SCENARIO_REFS["C9_sibling_property"], "물001 미상", 0)),
    ]
    return _build_workbook(
        sheet_name="OS List",
        recipient="인스보험중개, SEOUL, KOREA",
        header=PLA_HEADER,
        data_rows=rows,
    )


# ─── Driver ────────────────────────────────────────────────────────────────


def main() -> int:
    out_dir = Path(__file__).resolve().parents[1] / "synthetic"
    out_dir.mkdir(parents=True, exist_ok=True)

    artefacts = {
        "2026_01_PLA_INS.xlsx": make_month_1_pla(),
        "2026_01_SOC_INS.xlsx": make_month_1_soc(),
        "2026_02_PLA_INS.xlsx": make_month_2_pla(),
        "2026_02_SOC_INS.xlsx": make_month_2_soc(),
        "2026_03_PLA_INS.xlsx": make_month_3_pla(),
    }
    for name, wb in artefacts.items():
        target = out_dir / name
        wb.save(target)
        print(f"wrote {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
