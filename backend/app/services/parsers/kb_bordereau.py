"""Deterministic parser for KB monthly bordereau Excel files.

KB sends two report types each month:
- ``PLA`` (Outstanding Loss Advice): outstanding-reserve balances per
  claim. Sheet name ``OS List``. Revision lives in ``추산차수``.
- ``SOC`` (Settlement of Claim): settled / paid amounts. Sheet name
  ``SOC``. Revision lives in ``결정차수``. Includes per-currency
  ``Total`` rows that we cross-check against the row sum.

The two report types share the first ten columns (LoB, Policy, Insured,
dates, ``접수번호``, casualty) and diverge after that. We model each
shape with a :class:`ColumnMap`, parse rows uniformly, and stash report-
specific amount fields in :attr:`KBClaimRow.amounts`.

This parser is deterministic and never calls an LLM. ``ref_no`` parse
failures are collected as row-level warnings rather than raised so a
single bad row can't take down a 100-row file.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable, Optional

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

from .errors import KBSchemaError, RefNoParseError
from .ref_no_parser import ParsedRefNo, parse_kb_ref_no

logger = logging.getLogger(__name__)


# ─── Whitelisted sheet names ───────────────────────────────────────────────


SHEET_KIND_PLA = "PLA"
SHEET_KIND_SOC = "SOC"

_SHEET_NAME_TO_KIND = {
    "OS List": SHEET_KIND_PLA,
    "SOC": SHEET_KIND_SOC,
}


# ─── Column mapping ────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ColumnMap:
    """Maps canonical keys to 1-indexed Excel column numbers.

    Headers are matched against full synonym strings (whitespace
    collapsed) rather than keywords, because KB headers contain both
    Korean and English on the same cell separated by a newline (e.g.
    ``"상품명\\n(LoB)"``). Matching the full normalised string is
    deterministic and resilient to spurious keyword overlap.
    """

    indices: dict[str, int]
    header_row: int

    def get(self, key: str) -> Optional[int]:
        return self.indices.get(key)

    def require(self, key: str, sheet_name: str) -> int:
        idx = self.indices.get(key)
        if idx is None:
            raise KBSchemaError(
                f"required column {key!r} missing in sheet {sheet_name!r}"
            )
        return idx


# Canonical key → set of accepted header strings (whitespace collapsed,
# both newline halves preserved as a single ``\n``-joined token).
#
# When KB ships a new header phrasing, add it here; the parser is
# data-driven and won't need code edits otherwise.
_COMMON_SYNONYMS: dict[str, set[str]] = {
    "lob": {"상품명\n(LoB)"},
    "policy_no": {"증권번호 \n(Policy No)", "증권번호\n(Policy No)"},
    "insured": {"계약자명\n(Insured)"},
    "inception": {"보험개시일\n(Inception)"},
    "expiry": {"보험종료일\n(Expiry)"},
    "ref_no": {"접수번호\n(KB Ref)"},
    "dol": {"사고일자\n(DOL)"},
    "doc": {"배상청구일자\n(DOC)"},
    "loss_description": {"사고내용\n(Loss Description)"},
    "casualty": {"재해명\n(Casualty)"},
    "item_serial": {"목적물번호\n(Item Serial)"},
    "cession_serial": {"출재단위번호\n(Cession Serial)"},
    "coverage_code": {"담보코드\n(Coverage Code)"},
    "currency_claim": {"화폐\n(Currency_Claim)"},
    "currency_expense": {"화폐\n(Currency_Expense)"},
    "your_share_pct": {"출재율(%)\nYour Share(%)"},
}

_PLA_SYNONYMS: dict[str, set[str]] = {
    **_COMMON_SYNONYMS,
    "os_date": {"추산일자\n(OS Date)"},
    "os_serial": {"추산차수\n(OS Serial)"},
    "os_loss_indemnity": {"원보험금\n(OS Loss_Indemnity)"},
    "os_loss_others": {"원보험금_기타\n(OS Loss_Others)"},
    "os_expense": {"원 손해조사비\n(OS Expense)", "원손해조사비\n(OS Expense)"},
    "ceded_os_loss_indemnity": {"재보험금\n(Ceded OS Loss_Indemnity)"},
    "ceded_os_loss_others": {"재보험금_기타\n(Ceded OS Loss_Others)"},
    "ceded_os_expense": {"출재 손해조사비\n(Ceded OS Expense)", "출재손해조사비\n(Ceded OS Expense)"},
}

_SOC_SYNONYMS: dict[str, set[str]] = {
    **_COMMON_SYNONYMS,
    "paid_date": {"결정일자\n(Paid Date)"},
    "paid_serial": {"결정차수\n(Paid Serial)"},
    "separate_soc_date": {"개별SOC발송일자\n(Separate SOC Date)"},
    "paid_loss_indemnity": {"원수보험금\n(Paid Loss_Indemnity)"},
    "paid_loss_others": {"원수보험금_기타\n(Paid Loss_Others)"},
    "paid_expense": {"원수손해조사비\n(Paid Expense)"},
    "ceded_paid_loss_indemnity": {
        "출재보험금\n(Ceded Paid Loss_Indemnity)",
        "출재보험금\n(Ceded Paid Loss_Indemni",  # truncation seen in raw data
    },
    "ceded_paid_loss_others": {
        "출재보험금_기타\n(Ceded Paid Loss_Others)",
        "출재보험금_기타\n(Ceded Paid Loss_Othe",
    },
    "ceded_paid_expense": {"출재손해조사비\n(Ceded Paid Expense)"},
}


# Required columns must be present or the file is rejected. Anything
# else is best-effort.
_PLA_REQUIRED = ("ref_no", "insured", "dol", "your_share_pct", "os_serial")
_SOC_REQUIRED = ("ref_no", "insured", "dol", "your_share_pct", "paid_serial")

_AMOUNT_KEYS_PLA = (
    "os_loss_indemnity",
    "os_loss_others",
    "os_expense",
    "ceded_os_loss_indemnity",
    "ceded_os_loss_others",
    "ceded_os_expense",
)
_AMOUNT_KEYS_SOC = (
    "paid_loss_indemnity",
    "paid_loss_others",
    "paid_expense",
    "ceded_paid_loss_indemnity",
    "ceded_paid_loss_others",
    "ceded_paid_expense",
)


# ─── Output model ──────────────────────────────────────────────────────────


@dataclass
class KBClaimRow:
    """One claim row from a KB bordereau.

    ``ref_no`` is None when the source cell was blank or unparseable;
    in that case the row is still kept (to preserve totals) but
    downstream code should not use it as a join key.

    ``casualty`` (col 11), ``item_serial`` (col 14) and ``cession_serial``
    (col 15) together form the **sibling discriminator** — KB groups the
    indemnity-side and the property-side of a single incident under the
    same KB Ref + revision but distinct casualty (e.g. ``인001 미상`` vs
    ``물001 미상``). Treat them as part of the natural identity, not
    optional metadata.

    ``loss_description`` (col 10) is preserved for audit / debugging; it
    is not part of the natural key.
    """

    sheet_kind: str
    recipient: str
    row_index: int
    ref_no: Optional[ParsedRefNo]
    insured: Optional[str]
    policy_no: Optional[str]
    lob: Optional[str]
    inception: Optional[date]
    expiry: Optional[date]
    dol: Optional[date]
    doc: Optional[date]
    revision: Optional[int]
    casualty: Optional[str] = None
    item_serial: Optional[int] = None
    cession_serial: Optional[int] = None
    loss_description: Optional[str] = None
    paid_date: Optional[date] = None
    os_date: Optional[date] = None
    coverage_code: Optional[str] = None
    currency_claim: Optional[str] = None
    currency_expense: Optional[str] = None
    your_share_pct: Optional[Decimal] = None
    amounts: dict[str, Decimal] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def natural_key(
        self,
    ) -> tuple[
        str,
        Optional[str],
        Optional[str],
        Optional[int],
        Optional[int],
        Optional[int],
    ]:
        """Return the row's natural identity as a 6-tuple.

        ``(recipient, ref_no.key, casualty, item_serial, cession_serial,
        revision)``. Two rows that match on all six are true duplicates
        and warrant operator review; rows that share ``(ref, revision)``
        but split on ``casualty`` are sibling-casualty rows from the
        same incident and must both be retained.

        ``ref_no.key`` is used (not ``normalized``) so the key is
        whitespace-free and safe to drop into hash inputs or URL paths.
        Returns ``None`` for the ref slot when the row's ref_no failed
        to parse — such rows can't be safely joined.
        """
        return (
            self.recipient,
            self.ref_no.key if self.ref_no else None,
            self.casualty,
            self.item_serial,
            self.cession_serial,
            self.revision,
        )


@dataclass
class KBBordereauResult:
    file_name: str
    sheet_kind: str
    sheet_name: str
    recipient: str
    rows: list[KBClaimRow]
    totals_by_currency: dict[str, dict[str, Decimal]]
    warnings: list[str]
    skipped_sheets: list[str]


# ─── Cell coercion helpers ─────────────────────────────────────────────────


_BLANK_TOKENS = frozenset({"", "-", "(비어 있음)"})


def _normalize_header_cell(value: Any) -> str:
    """Collapse a header cell value to its canonical comparison form."""
    if value is None:
        return ""
    s = str(value).strip()
    # KB headers contain real newlines; preserve them as ``\n`` while
    # collapsing other whitespace.
    return re.sub(r"[ \t]+", " ", s)


def _coerce_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s and s not in _BLANK_TOKENS else None


def _coerce_decimal(value: Any) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return None
    s = str(value).strip().replace(",", "")
    if s in _BLANK_TOKENS:
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _coerce_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    if s in _BLANK_TOKENS:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _coerce_revision(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        # bool is a subclass of int — explicitly reject so True doesn't
        # silently become revision=1.
        return None
    if isinstance(value, (int, float)):
        try:
            return int(value)
        except (ValueError, OverflowError):
            return None
    s = str(value).strip()
    if not s or s in _BLANK_TOKENS:
        return None
    try:
        return int(s)
    except ValueError:
        return None


# ``item_serial`` / ``cession_serial`` follow the same shape as revision
# (Excel-typed integer or numeric string), so the coercion logic is
# identical. Aliased for call-site readability.
_coerce_int = _coerce_revision


# ─── Header detection ──────────────────────────────────────────────────────


_HEADER_SCAN_LIMIT = 25


def _build_synonym_index(synonyms: dict[str, set[str]]) -> dict[str, str]:
    """Invert the canonical-key → synonym set into a synonym → key map."""
    inverted: dict[str, str] = {}
    for key, alts in synonyms.items():
        for alt in alts:
            inverted[alt] = key
    return inverted


def _detect_header_row(ws: Worksheet, sheet_name: str) -> int:
    """Find the row that contains ``접수번호`` in any cell.

    KB files put a letterhead and recipient block at the top; the
    actual table header is usually row 12 but we don't hard-code it.
    """
    limit = min(_HEADER_SCAN_LIMIT, ws.max_row)
    for r in range(1, limit + 1):
        for c in range(1, ws.max_column + 1):
            v = ws.cell(row=r, column=c).value
            if v is None:
                continue
            if "접수번호" in str(v):
                return r
    raise KBSchemaError(
        f"header row containing '접수번호' not found in first "
        f"{limit} rows of sheet {sheet_name!r}"
    )


def _build_column_map(
    ws: Worksheet,
    sheet_name: str,
    synonyms: dict[str, set[str]],
    required: Iterable[str],
) -> ColumnMap:
    header_row = _detect_header_row(ws, sheet_name)
    inverted = _build_synonym_index(synonyms)
    indices: dict[str, int] = {}
    for c in range(1, ws.max_column + 1):
        cell = ws.cell(row=header_row, column=c).value
        normalized = _normalize_header_cell(cell)
        if not normalized:
            continue
        key = inverted.get(normalized)
        if key is not None and key not in indices:
            indices[key] = c

    missing = [k for k in required if k not in indices]
    if missing:
        raise KBSchemaError(
            f"required columns missing in sheet {sheet_name!r}: {missing}"
        )
    return ColumnMap(indices=indices, header_row=header_row)


# ─── Recipient detection ───────────────────────────────────────────────────


_RECIPIENT_SCAN_LIMIT = 20


def _detect_recipient(ws: Worksheet) -> str:
    """Pull the addressee from the ``To :`` line near the top."""
    limit = min(_RECIPIENT_SCAN_LIMIT, ws.max_row)
    for r in range(1, limit + 1):
        for c in range(1, ws.max_column + 1):
            v = ws.cell(row=r, column=c).value
            if v is None:
                continue
            label = str(v).strip()
            if label.rstrip(":").strip() == "To":
                # Recipient sits in the next non-empty cell on the same row.
                for nc in range(c + 1, ws.max_column + 1):
                    nv = ws.cell(row=r, column=nc).value
                    if nv is not None and str(nv).strip():
                        return str(nv).strip()
    return ""


# ─── Row parsing ───────────────────────────────────────────────────────────


def _read_row(ws: Worksheet, row: int, cmap: ColumnMap) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, col in cmap.indices.items():
        out[key] = ws.cell(row=row, column=col).value
    return out


def _read_full_row(ws: Worksheet, row: int) -> list[Any]:
    """Return raw values across the whole row (1-indexed positionally)."""
    return [ws.cell(row=row, column=c).value for c in range(1, ws.max_column + 1)]


def _detect_total_row(
    row_values: list[Any],
    sheet_kind: str,
) -> Optional[tuple[str, dict[str, Decimal]]]:
    """Parse a per-currency Total row by locating the 'Total' label.

    KB Total rows shift one column to the left of the data rows
    (the share column is omitted), so they can't be read through the
    same :class:`ColumnMap`. Both report types follow the same shape
    relative to the ``Total`` label:

    ``[Total | currency | self_indemnity | self_others | self_expense |
       (share skipped) | ceded_indemnity | ceded_others | ceded_expense]``
    """
    total_col: Optional[int] = None
    for c in range(1, len(row_values) + 1):
        v = row_values[c - 1]
        if v is not None and str(v).strip() == "Total":
            total_col = c
            break
    if total_col is None:
        return None

    currency_col = total_col + 1
    if currency_col > len(row_values):
        return None
    currency = _coerce_str(row_values[currency_col - 1])
    if not currency:
        return None

    if sheet_kind == SHEET_KIND_PLA:
        self_keys = ("os_loss_indemnity", "os_loss_others", "os_expense")
        ceded_keys = (
            "ceded_os_loss_indemnity",
            "ceded_os_loss_others",
            "ceded_os_expense",
        )
    else:
        self_keys = ("paid_loss_indemnity", "paid_loss_others", "paid_expense")
        ceded_keys = (
            "ceded_paid_loss_indemnity",
            "ceded_paid_loss_others",
            "ceded_paid_expense",
        )

    amounts: dict[str, Decimal] = {}
    # Self amounts immediately follow currency; ceded amounts follow after
    # one skipped position for the share column that is omitted from the
    # Total layout.
    for i, key in enumerate(self_keys, start=1):
        idx = currency_col + i
        if 1 <= idx <= len(row_values):
            v = _coerce_decimal(row_values[idx - 1])
            if v is not None:
                amounts[key] = v
    for i, key in enumerate(ceded_keys, start=5):
        idx = currency_col + i
        if 1 <= idx <= len(row_values):
            v = _coerce_decimal(row_values[idx - 1])
            if v is not None:
                amounts[key] = v

    return currency, amounts


def _parse_row(
    sheet_kind: str,
    recipient: str,
    row_index: int,
    raw: dict[str, Any],
    forward_filled_lob: Optional[str],
) -> KBClaimRow:
    notes: list[str] = []

    revision_key = "os_serial" if sheet_kind == SHEET_KIND_PLA else "paid_serial"
    revision = _coerce_revision(raw.get(revision_key))

    ref_raw = raw.get("ref_no")
    parsed_ref: Optional[ParsedRefNo] = None
    if ref_raw is not None and str(ref_raw).strip() not in _BLANK_TOKENS:
        try:
            parsed_ref = parse_kb_ref_no(str(ref_raw).strip(), revision=revision)
        except RefNoParseError as e:
            notes.append(f"ref_no parse failed: {e}")

    amounts_keys = _AMOUNT_KEYS_PLA if sheet_kind == SHEET_KIND_PLA else _AMOUNT_KEYS_SOC
    amounts: dict[str, Decimal] = {}
    for k in amounts_keys:
        if k in raw:
            v = _coerce_decimal(raw.get(k))
            if v is not None:
                amounts[k] = v

    return KBClaimRow(
        sheet_kind=sheet_kind,
        recipient=recipient,
        row_index=row_index,
        ref_no=parsed_ref,
        insured=_coerce_str(raw.get("insured")),
        policy_no=_coerce_str(raw.get("policy_no")),
        lob=_coerce_str(raw.get("lob")) or forward_filled_lob,
        inception=_coerce_date(raw.get("inception")),
        expiry=_coerce_date(raw.get("expiry")),
        dol=_coerce_date(raw.get("dol")),
        doc=_coerce_date(raw.get("doc")),
        revision=revision,
        casualty=_coerce_str(raw.get("casualty")),
        item_serial=_coerce_int(raw.get("item_serial")),
        cession_serial=_coerce_int(raw.get("cession_serial")),
        loss_description=_coerce_str(raw.get("loss_description")),
        paid_date=_coerce_date(raw.get("paid_date")),
        os_date=_coerce_date(raw.get("os_date")),
        coverage_code=_coerce_str(raw.get("coverage_code")),
        currency_claim=_coerce_str(raw.get("currency_claim")),
        currency_expense=_coerce_str(raw.get("currency_expense")),
        your_share_pct=_coerce_decimal(raw.get("your_share_pct")),
        amounts=amounts,
        notes=notes,
    )


# ─── Public entry points ───────────────────────────────────────────────────


def parse_kb_sheet(
    ws: Worksheet,
    file_name: str,
) -> KBBordereauResult:
    """Parse a single whitelisted KB sheet."""
    kind = _SHEET_NAME_TO_KIND.get(ws.title)
    if kind is None:
        raise KBSchemaError(
            f"sheet {ws.title!r} is not on the KB whitelist; "
            f"expected one of {sorted(_SHEET_NAME_TO_KIND)}"
        )

    synonyms = _PLA_SYNONYMS if kind == SHEET_KIND_PLA else _SOC_SYNONYMS
    required = _PLA_REQUIRED if kind == SHEET_KIND_PLA else _SOC_REQUIRED

    cmap = _build_column_map(ws, ws.title, synonyms, required)
    recipient = _detect_recipient(ws)

    rows: list[KBClaimRow] = []
    totals: dict[str, dict[str, Decimal]] = {}
    warnings: list[str] = []
    forward_lob: Optional[str] = None

    data_start = cmap.header_row + 1
    for r in range(data_start, ws.max_row + 1):
        full_row = _read_full_row(ws, r)

        # Per-currency Total rows are shifted one column left of the data
        # layout, so detect them off the literal 'Total' label and read
        # by relative offset.
        total = _detect_total_row(full_row, kind)
        if total is not None:
            cur, amts = total
            totals[cur] = amts
            continue

        raw = _read_row(ws, r, cmap)

        # Forward-fill the LoB column when KB merges it across siblings.
        lob_raw = _coerce_str(raw.get("lob"))
        if lob_raw is not None:
            forward_lob = lob_raw

        # Skip fully blank rows.
        if not any(_coerce_str(v) is not None for v in raw.values()):
            continue

        # Skip rows that look like spacer / decorative rows: no ref_no AND
        # no insured AND no policy_no.
        if (
            raw.get("ref_no") in (None, "")
            and _coerce_str(raw.get("insured")) is None
            and _coerce_str(raw.get("policy_no")) is None
        ):
            continue

        row = _parse_row(kind, recipient, r, raw, forward_lob)
        rows.append(row)
        for note in row.notes:
            warnings.append(f"row {r}: {note}")

    return KBBordereauResult(
        file_name=file_name,
        sheet_kind=kind,
        sheet_name=ws.title,
        recipient=recipient,
        rows=rows,
        totals_by_currency=totals,
        warnings=warnings,
        skipped_sheets=[],
    )


def parse_kb_bordereau(file_path: str | Path) -> KBBordereauResult:
    """Top-level entry point.

    Loads the workbook, picks the first sheet whose name is on the
    whitelist, records any other sheets as skipped, and delegates to
    :func:`parse_kb_sheet`.

    A KB workbook is expected to contain exactly one of
    ``OS List`` / ``SOC``; if neither is present the file is rejected.
    """
    path = Path(file_path)
    wb = load_workbook(path, data_only=True, read_only=False)

    target_sheet: Optional[Worksheet] = None
    skipped: list[str] = []
    for name in wb.sheetnames:
        if name in _SHEET_NAME_TO_KIND and target_sheet is None:
            target_sheet = wb[name]
        else:
            skipped.append(name)

    if target_sheet is None:
        raise KBSchemaError(
            f"no whitelisted KB sheet found in {path.name}; "
            f"expected one of {sorted(_SHEET_NAME_TO_KIND)}, "
            f"got {wb.sheetnames}"
        )

    result = parse_kb_sheet(target_sheet, path.name)
    result.skipped_sheets = skipped
    return result
