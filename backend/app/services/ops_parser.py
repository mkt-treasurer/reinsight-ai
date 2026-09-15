"""Parser for the firm's master contract-management ledger (AI계약관리.xlsx).

EXPERIMENTAL / ISOLATED — mirrors the rq-slip and weekly-dashboard tools: no
DB, no migrations, nothing here touches the live claims/contract pipelines.
The ops router persists each parsed upload as a dated JSON snapshot under
``backend/data/ops/`` so the dashboard can compute week-over-week deltas.

The workbook holds one ledger sheet per booking year — ``Actual2026``,
``Actual2025`` … — plus separate settlement sheets (``2025``, ``2024`` …) that
this parser ignores for now. Every ``Actual*`` sheet shares a header row
(found by scanning, not hard-coded — column order drifts year to year) with::

    Cont. Month | No. | Cover Note No. | Assured / Insured | Project Name |
    Line | Line 2 | New/Renew | Renewable | Retail | Original Cedant | Cedant |
    From | To | Installment | PPW | Currency | Gross Prem.(100%) |
    Gross Prem.(Inst.) | Reinsurer | Share | R/I Prem | RI/C | Net RI/P |
    Net RI/P (Kwon) | Net to Uwr | Rec. Date | Paid Date | Co-Brokerage |
    Partner | Brokerage | Brokerage(Kwon) | Ex. Rate | Account Mgr. |
    Producer | Remarks

One row = one reinsurer's share of a placement. Contract-identity columns are
forward-filled because some rows leave them blank on continuation shares.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl

# Canonical field -> set of accepted (normalised) header labels. Matching is on
# the whitespace-collapsed, lower-cased header text, exact-equality so "share"
# never swallows "co-brokerage" etc.
HEADER_ALIASES: dict[str, set[str]] = {
    "cont_month": {"cont. month", "cont month"},
    "no": {"no."},
    "cover_note": {"cover note no.", "cover note no"},
    "assured": {"assured / insured", "assured/insured", "assured / insured ", "assured"},
    "project": {"project name"},
    "line": {"line"},
    "line2": {"line 2"},
    "new_renew": {"new/renew", "new / renew"},
    "renewable": {"renewable"},
    "retail": {"retail"},
    "original_cedant": {"original cedant"},
    "cedant": {"cedant"},
    "date_from": {"from"},
    "date_to": {"to"},
    "installment": {"installment"},
    "ppw": {"ppw"},
    "currency": {"currency"},
    "gross_prem_100": {"gross prem.(100%)", "gross prem (100%)", "gross prem.(100 %)"},
    "gross_prem_inst": {"gross prem.(inst.)", "gross prem (inst.)"},
    "reinsurer": {"reinsurer"},
    "share": {"share"},
    "ri_prem": {"r/i prem", "ri prem"},
    "ri_comm": {"ri/c", "r/i comm", "ri comm"},
    "net_rip": {"net ri/p"},
    "net_to_uwr": {"net to uwr"},
    "rec_date": {"rec. date", "rec date"},
    "paid_date": {"paid date"},
    "brokerage": {"brokerage"},
    "ex_rate": {"ex. rate", "ex rate"},
    "account_mgr": {"account mgr.", "account mgr", "account  mgr."},
    "producer": {"producer"},
    "remarks": {"remarks"},
}

# Identity columns carried down to continuation rows that only carry a new
# reinsurer share. Share-level columns (reinsurer, share, premiums, dates,
# people) are NEVER forward-filled.
_FILL_FIELDS = (
    "cont_month", "no", "cover_note", "assured", "project", "line", "line2",
    "new_renew", "renewable", "retail", "original_cedant", "cedant",
    "date_from", "date_to", "installment", "ppw", "currency",
    "gross_prem_100", "gross_prem_inst",
)

_DATE_FIELDS = ("date_from", "date_to", "ppw", "rec_date", "paid_date")
_NUM_FIELDS = ("gross_prem_100", "gross_prem_inst", "share", "ri_prem",
               "ri_comm", "net_rip", "net_to_uwr", "brokerage", "ex_rate")

_HEADER_PROBE = {"cover note no.", "assured / insured", "reinsurer"}


def _norm(value: Any) -> str:
    """Whitespace-collapsed, NFC-normalised, lower-cased header text."""
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFC", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def _s(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()


def _iso_date(value: Any) -> str | None:
    """ISO date for real date cells; None for blanks / unparseable tokens."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = _s(value)
    m = re.search(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})", text)
    if m:
        y, mo, d = m.groups()
        try:
            return date(int(y), int(mo), int(d)).isoformat()
        except ValueError:
            return None
    return None


def _num(value: Any) -> float | None:
    """Numeric value only when the cell is a clean number; else None so the
    dashboard separates summable figures from free-text that needs review."""
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = str(value).strip().replace(",", "").replace("%", "")
    if re.fullmatch(r"-?\d+(\.\d+)?", text):
        return float(text)
    return None


def _cell(values: tuple, pos: int) -> Any:
    """Value at a 0-indexed position, tolerant of short rows."""
    return values[pos] if 0 <= pos < len(values) else None


# Header must appear within this many rows; some ledger sheets carry a few
# summary rows above it.
_HEADER_SCAN = 25
# Some sheets report a corrupted max_row near Excel's 1,048,576 limit; bail out
# after this many consecutive blank rows once real data has been seen.
_EMPTY_TAIL = 200


def _header_positions(values: tuple) -> dict[str, int] | None:
    """If `values` is the column header, return {field: 0-indexed position}."""
    labels = {_norm(v) for v in values if v is not None}
    if len(labels & _HEADER_PROBE) < 2:
        return None
    field_to_pos: dict[str, int] = {}
    for pos, v in enumerate(values):
        norm = _norm(v)
        if not norm:
            continue
        for field, aliases in HEADER_ALIASES.items():
            if norm in aliases and field not in field_to_pos:
                field_to_pos[field] = pos
    if "assured" in field_to_pos and "reinsurer" in field_to_pos:
        return field_to_pos
    return None


def _sheet_year(title: str) -> int | None:
    m = re.search(r"(\d{4})", title or "")
    return int(m.group(1)) if m else None


def _parse_ws(ws, year: int | None) -> list[dict[str, Any]]:
    """Stream one ledger sheet into normalised share rows."""
    cols: dict[str, int] | None = None
    carried: dict[str, Any] = {}
    rows: list[dict[str, Any]] = []
    empty_run = 0

    for i, values in enumerate(ws.iter_rows(values_only=True)):
        if cols is None:
            cols = _header_positions(values)
            if cols is None and i >= _HEADER_SCAN:
                return []  # no recognisable header near the top
            continue

        if all(v is None or _s(v) == "" for v in values):
            empty_run += 1
            if rows and empty_run > _EMPTY_TAIL:
                break  # corrupted long tail — stop streaming
            continue
        empty_run = 0

        raw = {field: _cell(values, pos) for field, pos in cols.items()}

        # Forward-fill identity fields; a continuation share row inherits them.
        for f in _FILL_FIELDS:
            if _s(raw.get(f)):
                carried[f] = raw.get(f)
            else:
                raw[f] = carried.get(f)

        assured = _s(raw.get("assured"))
        # Inclusion uses ONLY raw share-level signals (reinsurer/share are never
        # forward-filled) so an empty tail under a filled contract is not
        # mistaken for thousands of phantom shares.
        reinsurer = _s(raw.get("reinsurer"))
        share = _num(raw.get("share"))
        if not assured or _norm(assured) in _HEADER_PROBE:
            continue
        if not (reinsurer or share is not None):
            continue

        rec: dict[str, Any] = {"book_year": year}
        for field in HEADER_ALIASES:
            if field in _DATE_FIELDS:
                rec[field] = _iso_date(raw.get(field))
            elif field in _NUM_FIELDS:
                rec[field] = _num(raw.get(field))
            else:
                rec[field] = _s(raw.get(field)) or None
        rows.append(rec)

    return rows


# ── settlement (선수금) ledger ────────────────────────────────────────────────
# Bare-year sheets ("2025", "2024" …) are the advance-payment cash ledger, laid
# out as two side-by-side blocks under section labels:
#
#   선수금입금내역 (advance RECEIPT from cedant)   선수금송금내역 (REMITTANCE to reinsurer)
#   Date | KRW | USD | ROE | Reinsurer || Date | KRW | USD | ROE | 수수료 KRW | USD |
#   선수금잔액 | 환차손/익 | Net to | Assured | Remarks | PRE/CLM | Account Mgr.
#
# A header band of two rows (section labels, then column labels + unit sub-row).
# Money columns split KRW / USD with a per-row ROE, so AR/AP and FX gain/loss
# are reconciled from the real cash movements — not inferred from the contract
# ledger's blank Rec./Paid dates.

# Unique, position-stable column labels we can pin by name.
_SET_RECEIPT_LABEL = "선수금입금내역"
_SET_REMIT_LABEL = "선수금송금내역"
_SET_LABEL_COLS: dict[str, set[str]] = {
    "reinsurer": {"reinsurer"},
    "balance": {"선수금잔액"},
    "fx_gl": {"환차손/익", "환차손익"},
    "net_to": {"net to", "net to uwr"},
    "assured": {"assured", "assured / insured"},
    "remarks": {"remarks"},
    "pre_clm": {"pre /clm", "pre/clm"},
    "account_mgr": {"account mgr.", "account mgr"},
}
_SET_DATE_FIELDS = ("recv_date", "remit_date")
# 환차손/익 (fx_gl) is a TEXT marker — 환차익 / 환차손 / 잡이익 / blank — not an
# amount, so it stays a string and is counted, never summed.
_SET_NUM_FIELDS = ("recv_krw", "recv_usd", "recv_roe", "remit_krw", "remit_usd",
                   "remit_roe", "comm_krw", "comm_usd", "balance")
_SET_HEADER_SCAN = 12


def _settlement_columns(ws) -> tuple[dict[str, int], int] | None:
    """Locate the settlement header. Returns ({field: 0-indexed col}, data_start
    row index) or None if this is not a recognisable 선수금 sheet.

    Block columns (date + KRW/USD/ROE) are anchored on the section-label row;
    standalone columns (reinsurer, 선수금잔액 …) are pinned by their unique label.
    """
    rows = []
    for i, values in enumerate(ws.iter_rows(values_only=True)):
        rows.append(values)
        if i >= _SET_HEADER_SCAN:
            break

    recv_start = remit_start = None
    section_row = None
    for idx, values in enumerate(rows):
        labels = {_norm(v): pos for pos, v in enumerate(values)}
        if _SET_RECEIPT_LABEL in labels and _SET_REMIT_LABEL in labels:
            recv_start = labels[_SET_RECEIPT_LABEL]
            remit_start = labels[_SET_REMIT_LABEL]
            section_row = idx
            break
    if recv_start is None or remit_start is None or section_row is None:
        return None

    cols: dict[str, int] = {
        "recv_date": recv_start,
        "recv_krw": recv_start + 1,
        "recv_usd": recv_start + 2,
        "recv_roe": recv_start + 3,
        "remit_date": remit_start,
        "remit_krw": remit_start + 1,
        "remit_usd": remit_start + 2,
        "remit_roe": remit_start + 3,
        "comm_krw": remit_start + 4,
        "comm_usd": remit_start + 5,
    }
    # Pin the standalone columns by their unique label, scanning the header band.
    for values in rows[section_row:]:
        for pos, v in enumerate(values):
            norm = _norm(v)
            if not norm:
                continue
            for field, aliases in _SET_LABEL_COLS.items():
                if norm in aliases and field not in cols:
                    cols[field] = pos

    if "balance" not in cols or "assured" not in cols:
        return None
    # Data begins after the header band — the label row plus its unit sub-row.
    return cols, section_row + 3


def _parse_settlement_ws(ws, year: int | None) -> list[dict[str, Any]]:
    """Stream one 선수금 settlement sheet into normalised cash-movement rows."""
    located = _settlement_columns(ws)
    if located is None:
        return []
    cols, data_start = located

    rows: list[dict[str, Any]] = []
    empty_run = 0
    for i, values in enumerate(ws.iter_rows(values_only=True)):
        if i < data_start:
            continue
        if all(v is None or _s(v) == "" for v in values):
            empty_run += 1
            if rows and empty_run > _EMPTY_TAIL:
                break
            continue
        empty_run = 0

        raw = {field: _cell(values, pos) for field, pos in cols.items()}
        recv_date = _iso_date(raw.get("recv_date"))
        remit_date = _iso_date(raw.get("remit_date"))
        recv_krw = _num(raw.get("recv_krw"))
        remit_krw = _num(raw.get("remit_krw"))
        assured = _s(raw.get("assured"))
        # A real movement row needs a date or an amount, plus a counterparty.
        has_movement = any((recv_date, remit_date, recv_krw is not None, remit_krw is not None))
        if not has_movement or not (assured or _s(raw.get("reinsurer"))):
            continue
        if _norm(assured) in {"assured", "assured / insured"}:
            continue

        rec: dict[str, Any] = {"book_year": year}
        for field in cols:
            if field in _SET_DATE_FIELDS:
                rec[field] = _iso_date(raw.get(field))
            elif field in _SET_NUM_FIELDS:
                rec[field] = _num(raw.get(field))
            else:
                rec[field] = _s(raw.get(field)) or None
        rows.append(rec)

    return rows


def parse_workbook(path: str | Path, filename: str | None = None) -> dict[str, Any]:
    """Parse the contract-management workbook into normalised rows.

    Returns ``{filename, rows, settlement, sheets, settlement_sheets}``:
    ``rows`` are contract share rows from the ``Actual*`` ledgers; ``settlement``
    are cash-movement rows from the bare-year 선수금 ledgers. Streams in read-only
    mode so the corrupted-tail settlement sheets never fully materialise.
    """
    name = unicodedata.normalize("NFC", filename or Path(path).name)
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows: list[dict[str, Any]] = []
    settlement: list[dict[str, Any]] = []
    sheets: dict[str, int] = {}
    settlement_sheets: dict[str, int] = {}
    try:
        for ws in wb.worksheets:
            title = ws.title or ""
            is_settlement = bool(re.fullmatch(r"\d{4}", title.strip()))
            try:
                if title.lower().startswith("actual"):
                    parsed = _parse_ws(ws, _sheet_year(title))
                    if parsed:
                        sheets[title] = len(parsed)
                        rows.extend(parsed)
                elif is_settlement:
                    parsed = _parse_settlement_ws(ws, _sheet_year(title))
                    if parsed:
                        settlement_sheets[title] = len(parsed)
                        settlement.extend(parsed)
            except Exception:  # one bad sheet must not kill the upload
                continue
    finally:
        wb.close()

    return {
        "filename": name,
        "rows": rows,
        "settlement": settlement,
        "sheets": sheets,
        "settlement_sheets": settlement_sheets,
    }


# ── settlement aggregation (server-side, to bound the client payload) ─────────
# The full ledger is tens of thousands of rows / ~25 MB of JSON, so we never
# ship it whole. ``open_settlement`` keeps only actionable rows; ``summarise_
# settlement`` rolls the rest up into small totals the dashboard renders directly.

def is_open_settlement(row: dict[str, Any]) -> bool:
    """An actionable row: received from the cedant but not yet remitted to the
    reinsurer, or carrying a non-zero advance balance (선수금잔액)."""
    received = bool(row.get("recv_date")) or row.get("recv_krw") is not None
    remitted = bool(row.get("remit_date"))
    balance = row.get("balance") or 0
    return (received and not remitted) or balance != 0


# Only the columns the dashboard's open-items table renders. The summary is
# computed from the FULL rows first, so projecting here just trims the shipped
# payload (remit_date is kept — the client narrows to remit-pending with it).
SETTLE_SHIP_FIELDS = (
    "recv_date", "recv_krw", "recv_usd", "reinsurer", "remit_date",
    "balance", "assured", "account_mgr",
)


def open_settlement(settlement: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Open/actionable rows, projected to just the fields the UI table shows."""
    return [
        {k: r.get(k) for k in SETTLE_SHIP_FIELDS}
        for r in settlement
        if is_open_settlement(r)
    ]


def summarise_settlement(settlement: list[dict[str, Any]]) -> dict[str, Any]:
    """Small roll-up over the full ledger: currency-split totals (KRW and USD are
    never blindly added), advance balance, FX-marker counts, and per-year splits."""
    def _f(v: Any) -> float:
        return float(v) if isinstance(v, (int, float)) else 0.0

    by_year: dict[str, dict[str, float]] = {}
    totals = {"recv_krw": 0.0, "recv_usd": 0.0, "remit_krw": 0.0, "remit_usd": 0.0,
              "balance_krw": 0.0, "fx_gain": 0, "fx_loss": 0, "open_count": 0,
              "row_count": len(settlement)}
    for r in settlement:
        totals["recv_krw"] += _f(r.get("recv_krw"))
        totals["recv_usd"] += _f(r.get("recv_usd"))
        totals["remit_krw"] += _f(r.get("remit_krw"))
        totals["remit_usd"] += _f(r.get("remit_usd"))
        totals["balance_krw"] += _f(r.get("balance"))
        marker = (r.get("fx_gl") or "").strip()
        if "익" in marker:
            totals["fx_gain"] += 1
        elif "손" in marker:
            totals["fx_loss"] += 1
        if is_open_settlement(r):
            totals["open_count"] += 1
        yr = str(r.get("book_year") or "—")
        slot = by_year.setdefault(yr, {"recv_krw": 0.0, "balance_krw": 0.0, "open_count": 0})
        slot["recv_krw"] += _f(r.get("recv_krw"))
        slot["balance_krw"] += _f(r.get("balance"))
        slot["open_count"] += 1 if is_open_settlement(r) else 0

    totals["by_year"] = dict(sorted(by_year.items(), reverse=True))
    return totals
