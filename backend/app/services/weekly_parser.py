"""Parser for the internal "Weekly Result & Plan" reinsurance reports.

EXPERIMENTAL / ISOLATED — mirrors the rq-slip tool's philosophy: no DB, no
migrations, nothing here touches the live claims/contract pipelines. The
weekly-dashboard router persists parsed output as plain JSON under
``backend/data/weekly/``.

Each workbook has one sheet per business line (C/T/P/M/G). Every sheet shares
a fixed column layout (header row 4)::

    E Inception Date | F Type | G Account Name | H Retail/Re | I Insurer
    J Cedent | K Share'25 | L 100%Prem'25 | M Brokerage'25
    N Share'26 | O 100%Prem'26 | P Brokerage'26 | Q Handler | S Remark

Status lives in column B ("Completed" / "In Progress" / "Others") and the
sub-category in column C ("Renewal" / "New" / "Retail" / "Claim" / ...). Both
are *sticky*: a value applies to every row below it until the next value in
that column. The deal table runs until a sub-table header row (e.g. a
"Date of Loss" claims block or a "Date / Time / Visitors" meeting block).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl

# Sheet code (stripped & upper) -> canonical business-line name. The workbook
# title cell A1 carries the same name in parentheses; the code is the fallback.
LINE_NAMES: dict[str, str] = {
    "C": "Casualty",
    "T": "Treaty",
    "P": "Property",
    "M": "Marine",
    "G": "Global/Retail",
}

# Fixed column letters (1-indexed) from header row 4.
COL = {
    "status": 2,   # B
    "category": 3,  # C
    "inception": 5,  # E
    "type": 6,      # F
    "account": 7,   # G
    "retail_re": 8,  # H
    "insurer": 9,   # I
    "cedent": 10,    # J
    "share_2025": 11,  # K
    "prem_2025": 12,   # L
    "brk_2025": 13,    # M
    "share_2026": 14,  # N
    "prem_2026": 15,   # O
    "brk_2026": 16,    # P
    "handler": 17,     # Q
    "remark": 19,      # S
}

DEAL_STATUSES = {"completed", "in progress"}
DEAL_CATEGORIES = {"renewal", "new", "retail"}

# Rows we never treat as deals: template placeholders and sub-table headers.
_TEMPLATE_TOKENS = {"various", "-", "￭", ""}
_SUBTABLE_MARKERS = {"date of loss", "cause of loss", "date", "visitors"}

# Best-known handler-initial → staff name. Unknown initials render as-is.
HANDLER_NAMES: dict[str, str] = {
    "KST": "김성태",
    "CYM": "최영민",
    "KCW": "김찬우",
    "RSK": "노석균",
    "HUJ": "허유진",
    "BHJ": "배호진",
}

_DATE_RANGE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})\s*[~\-–]\s*(\d{4}-\d{2}-\d{2})")


def _s(value: Any) -> str:
    """Trimmed string for a cell value (None -> '')."""
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return str(value).strip()


def _num(value: Any) -> float | None:
    """Numeric value of a cell, only when it is a clean number.

    Free-text amounts ("USD 70,000", "약 2억", "MDP \\20,000,000") return None
    so the dashboard can honestly separate "summable" from "needs review".
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if re.fullmatch(r"-?\d+(\.\d+)?", text):
        return float(text)
    return None


def _inception(value: Any) -> str:
    """ISO date when parseable, else the raw token (e.g. 'TBA')."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return _s(value)


def parse_week_range(filename: str) -> tuple[str | None, str | None]:
    """Pull the (start, end) ISO dates from a report filename, if present."""
    match = _DATE_RANGE_RE.search(filename or "")
    if match:
        return match.group(1), match.group(2)
    return None, None


def detect_source(filename: str) -> str:
    """'consolidated' for 취합본 files, else the contributor label.

    macOS stores Hangul filenames as NFD; normalise to NFC before matching the
    composed literal, otherwise the substring test silently never fires.
    """
    name = unicodedata.normalize("NFC", filename or "")
    if "취합본" in name:
        return "consolidated"
    return "personal"


def _line_name(sheet_title: str, title_cell: str) -> str:
    """Resolve the business-line name from the A1 parenthetical, else the code."""
    match = re.search(r"\(([^)]+)\)", title_cell or "")
    if match:
        return match.group(1).strip()
    code = (sheet_title or "").strip().upper()
    return LINE_NAMES.get(code, code or "Unknown")


def _is_subtable_header(cells: list[str]) -> bool:
    """A 'Date of Loss…' / 'Date | Time | Visitors' row ends the deal table."""
    lowered = {c.lower() for c in cells if c}
    return len(lowered & _SUBTABLE_MARKERS) >= 2


def _parse_sheet(ws: openpyxl.worksheet.worksheet.Worksheet) -> list[dict[str, Any]]:
    title_cell = _s(ws.cell(row=1, column=1).value)
    line = _line_name(ws.title, title_cell)
    line_code = (ws.title or "").strip().upper()[:1]

    deals: list[dict[str, Any]] = []
    current_status = ""
    current_category = ""

    def col(row_cells: dict[int, Any], key: str) -> Any:
        return row_cells.get(COL[key])

    for row in ws.iter_rows(min_row=5):
        row_cells = {c.column: c.value for c in row}
        all_text = [_s(v) for v in row_cells.values()]

        status_cell = _s(col(row_cells, "status"))
        category_cell = _s(col(row_cells, "category"))
        if status_cell:
            current_status = status_cell
        if category_cell:
            current_category = category_cell

        # A sub-table header (Claims / Meeting / Biz Trip) terminates deals
        # for this sheet — everything below is a different layout.
        if _is_subtable_header(all_text):
            break

        if current_status.lower() not in DEAL_STATUSES:
            continue
        if current_category.lower() not in DEAL_CATEGORIES:
            continue

        account = _s(col(row_cells, "account"))
        if account.lower() in _TEMPLATE_TOKENS:
            continue

        handler = _s(col(row_cells, "handler"))
        deals.append(
            {
                "line": line,
                "line_code": line_code,
                "status": current_status,
                "category": current_category,
                "inception": _inception(col(row_cells, "inception")),
                "type": _s(col(row_cells, "type")),
                "account": account,
                "retail_re": _s(col(row_cells, "retail_re")),
                "insurer": _s(col(row_cells, "insurer")),
                "cedent": _s(col(row_cells, "cedent")),
                "share_2025": _num(col(row_cells, "share_2025")),
                "prem_2025_raw": _s(col(row_cells, "prem_2025")),
                "prem_2025_num": _num(col(row_cells, "prem_2025")),
                "brk_2025_num": _num(col(row_cells, "brk_2025")),
                "share_2026": _num(col(row_cells, "share_2026")),
                "prem_2026_raw": _s(col(row_cells, "prem_2026")),
                "prem_2026_num": _num(col(row_cells, "prem_2026")),
                "brk_2026_num": _num(col(row_cells, "brk_2026")),
                "handler": handler,
                "handler_name": HANDLER_NAMES.get(handler.upper(), handler),
                "remark": _s(col(row_cells, "remark")),
            }
        )
    return deals


def parse_workbook(path: str | Path, filename: str | None = None) -> dict[str, Any]:
    """Parse one weekly report workbook into a structured payload.

    Returns ``{week_start, week_end, source, filename, deals: [...]}``. Raises
    ValueError when no readable sheet/deal structure is found so the caller can
    reject a clearly-wrong upload.
    """
    name = unicodedata.normalize("NFC", filename or Path(path).name)
    # NOT read_only: that mode yields EmptyCell objects without a .column
    # attribute for blank cells, and these sheets are tiny (~30 rows).
    wb = openpyxl.load_workbook(path, data_only=True)
    deals: list[dict[str, Any]] = []
    for ws in wb.worksheets:
        try:
            deals.extend(_parse_sheet(ws))
        except Exception:  # one malformed sheet must not kill the whole upload
            continue
    wb.close()

    start, end = parse_week_range(name)
    return {
        "week_start": start,
        "week_end": end,
        "source": detect_source(name),
        "filename": name,
        "deals": deals,
    }
