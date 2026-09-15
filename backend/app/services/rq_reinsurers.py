"""Reinsurer contact-directory structuring (insightre.ai placement track, M7).

EXPERIMENTAL / ISOLATED. Pure functions — no DB, no I/O beyond reading an
uploaded workbook path. Turns the broker's heterogeneous multi-sheet reinsurer
contact directory (Property / Casualty / Engineering / Marine / Treaty / MGA /
Global Network — each with a different header layout) into uniform contact
records, then, given an extracted slip's ``line``, returns the reinsurers to
approach for that risk.

The contact directory holds real names / direct emails / phone numbers (PII),
so it is NEVER committed to the repo or bundled — it is supplied at request
time as an upload, exactly like the cedent RQ documents. Nothing here persists.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, asdict

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_MARKER = "●"  # ● — Casualty sheet marks the sub-line a contact covers
_JUNK_COMPANY = {"", "#ref!", "n/a", "na", "-"}

# Casualty sub-line columns, by the header token that identifies each one.
_CASUALTY_SUBLINES = ("PI", "PL(CGL)", "RECALL", "CYBER", "BBB", "D&O", "OTHERS")

# Header-keyword → canonical field. First match wins; checked lowercased.
_FIELD_KEYWORDS: dict[str, tuple[str, ...]] = {
    "company": ("회사명", "회사", "company", "reinsurer", "mga"),
    "contact": ("담당자명", "담당자", "contact name", "main contact", "contact", "u/w"),
    "title": ("직위",),
    "phone": ("전화", "phone", "fax"),
    "email": ("e-mail", "email", "메일"),
    "location": ("소재지", "location", "country"),
    "remarks": ("비고", "remark", "remarks", "담당업무", "business line", "business", "당사 참여"),
}

# Slip line text → (sheet, casualty sub-line | None). Order matters: the first
# pattern that hits wins, so specific liability lines precede the generic ones.
_LINE_RULES: tuple[tuple[str, str, str | None], ...] = (
    (r"d\s*&\s*o|director|officer|임원", "Casualty", "D&O"),
    (r"professional\s+indemnity|\bpi\b|\be&o\b|errors?\s+and\s+omissions|전문직", "Casualty", "PI"),
    (r"product\s+recall|\brecall\b|리콜", "Casualty", "RECALL"),
    (r"\bcyber\b|사이버", "Casualty", "CYBER"),
    (r"\bbbb\b|banker'?s\s+blanket", "Casualty", "BBB"),
    (r"general\s+liabilit|\bcgl\b|\bgl\b|영업배상|배상책임|product.*liabilit", "Casualty", "PL(CGL)"),
    (r"liabilit|\bcasualty\b|책임", "Casualty", None),
    (r"\bcar\b|\bear\b|erection|construction|engineering|건설|공사|기계|조립", "Engineering", None),
    (r"marine|cargo|\bhull\b|적하|선박|해상", "Marine", None),
    (r"propert|\bfire\b|화재|재물|물보험", "Property", None),
    (r"treaty|특약", "Treaty", None),
)


@dataclass(frozen=True)
class ReinsurerContact:
    company: str
    contact: str
    title: str
    email: str
    phone: str
    location: str
    remarks: str
    sheet: str
    lines: tuple[str, ...]  # Casualty sub-line tags; () for flat sheets


def _clean(v: object) -> str:
    """Normalize a cell to a single-line trimmed string."""
    if v is None:
        return ""
    return " ".join(str(v).split())


def _detect_header(rows: list[tuple]) -> tuple[int, dict[str, int], list[tuple[str, int]]]:
    """Find the header row in the first few rows and map columns.

    Returns (header_row_index, {field: col}, [(subline, col), …]). The marker
    list is non-empty only for the Casualty-style sheet. Raises nothing — an
    undetected header yields (-1, {}, []).
    """
    best = (-1, {}, [])
    best_score = 0
    for idx, row in enumerate(rows[:8]):
        cells = [_clean(c).lower() for c in row]
        field_map: dict[str, int] = {}
        for col, text in enumerate(cells):
            if not text:
                continue
            for field, keywords in _FIELD_KEYWORDS.items():
                if field in field_map:
                    continue
                if any(k in text for k in keywords):
                    field_map[field] = col
                    break
        markers = [
            (sub, col)
            for col, raw in enumerate(_clean(c) for c in row)
            for sub in _CASUALTY_SUBLINES
            if raw.upper() == sub.upper()
        ]
        score = len(field_map) + len(markers)
        # Need at least a name/company + email to call it a header.
        if score > best_score and ("email" in field_map or "contact" in field_map):
            best = (idx, field_map, markers)
            best_score = score
    return best


def _parse_sheet(name: str, rows: list[tuple]) -> list[ReinsurerContact]:
    header_idx, fmap, markers = _detect_header(rows)
    if header_idx < 0:
        return []

    out: list[ReinsurerContact] = []
    last_company = ""
    for row in rows[header_idx + 1 :]:
        def cell(field: str) -> str:
            col = fmap.get(field)
            return _clean(row[col]) if col is not None and col < len(row) else ""

        company = cell("company")
        if company.lower() in _JUNK_COMPANY:
            company = last_company  # forward-fill grouped rows / skip #REF!
        elif company:
            last_company = company

        email_raw = cell("email") or cell("contact")
        email_match = _EMAIL_RE.search(email_raw)
        email = email_match.group(0) if email_match else ""

        contact = cell("contact")
        # Strip a trailing "<email>" the directory sometimes packs into a cell.
        contact = re.sub(r"\s*<[^>]*>", "", contact).strip()

        lines = tuple(
            sub for sub, col in markers if col < len(row) and _MARKER in _clean(row[col])
        )

        # Keep a row only if it carries a usable contact signal.
        if not (email or contact) or not company:
            continue

        out.append(
            ReinsurerContact(
                company=company,
                contact=contact,
                title=cell("title"),
                email=email,
                phone=cell("phone"),
                location=cell("location"),
                remarks=cell("remarks"),
                sheet=name,
                lines=lines,
            )
        )
    return out


def parse_directory(path: str) -> dict[str, list[ReinsurerContact]]:
    """Parse every sheet of the uploaded contact workbook into uniform records."""
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    parsed: dict[str, list[ReinsurerContact]] = {}
    try:
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True))
            parsed[ws.title] = _parse_sheet(ws.title, rows)
    finally:
        wb.close()
    return parsed


def classify_line(line: str) -> tuple[str, str | None]:
    """Map a slip line description to (sheet, casualty_sub_line | None).

    Defaults to ('Casualty', None) — the broadest liability bucket — when no
    rule matches, since the placement desk's RQ traffic is liability-heavy.
    """
    text = (line or "").lower()
    for pattern, sheet, sub in _LINE_RULES:
        if re.search(pattern, text):
            return sheet, sub
    return "Casualty", None


def match_reinsurers(parsed: dict[str, list[ReinsurerContact]], line: str) -> dict:
    """Return the reinsurer contacts to approach for the given slip line."""
    sheet, sub = classify_line(line)
    sheet_contacts = parsed.get(sheet, [])

    if sub:
        primary = [c for c in sheet_contacts if sub in c.lines]
        # Fall back to the whole sheet if nobody is tagged for this sub-line.
        contacts = primary if primary else sheet_contacts
    else:
        contacts = sheet_contacts

    return {
        "line": line,
        "matched_sheet": sheet,
        "sub_line": sub,
        "contacts": [asdict(c) for c in contacts],
        "available_sheets": {name: len(items) for name, items in parsed.items()},
    }
