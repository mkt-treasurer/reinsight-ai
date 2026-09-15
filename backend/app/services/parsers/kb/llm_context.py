"""Render a :class:`KBBordereauResult` as an LLM-prompt-friendly
context block.

When ``KB_PARSER_MODE`` is ``ON``, the deterministic parsing output
is paste-injected into the existing Pass-1 prompt so the model has
ground-truth row data alongside the raw xlsx text dump. The format
stays compact so the model can still attend to its other inputs.

Trade-offs surfaced in Step 1:

- Format = JSON-y compact rows + a per-currency totals table.
  Easier for the model to copy ref values verbatim than free-form
  prose, and the totals are readable at a glance for cross-check.
- ``loss_description`` is dropped — long Korean free text doesn't
  help reasoning and burns tokens.
- ``casualty`` is kept — it disambiguates sibling rows (인001/물001)
  that the LLM otherwise tends to merge.
- A per-row line is capped at ~120 chars so 100-row bordereaux
  stay under ~12k tokens (well within the 32k context budget).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable

from ..kb_bordereau import KBBordereauResult, KBClaimRow


# Cap rows aggressively — production bordereaux top out around 100,
# and the LLM only needs the row shape + values, not the full novel.
_MAX_ROWS = 200


def _fmt_amount(v: Decimal | int | float | None) -> str:
    """Render an amount without thousand separators.

    Comma-grouped numbers like ``100,000`` look human-friendly but
    confuse LLM token boundaries (the comma inside a number can be
    mistaken for a list separator). Plain digits are unambiguous.
    """
    if v is None:
        return ""
    if isinstance(v, Decimal):
        return f"{v:.2f}".rstrip("0").rstrip(".")
    return f"{float(v):.2f}".rstrip("0").rstrip(".")


def _row_to_compact_line(row: KBClaimRow) -> str:
    """One row → one comma-separated line, structured but not JSON.

    The tagging (``ref=...``, ``cas=...``) gives the LLM a clear
    schema without a heavy syntax. Skip empty fields rather than
    emit ``=None`` pairs — keeps the line short.
    """
    parts: list[str] = []
    parts.append(f"row={row.row_index}")
    if row.ref_no is not None:
        parts.append(f"ref={row.ref_no.normalized}")
    if row.casualty:
        parts.append(f"cas={row.casualty}")
    if row.item_serial is not None:
        parts.append(f"item={row.item_serial}")
    if row.cession_serial is not None:
        parts.append(f"cession={row.cession_serial}")
    if row.revision is not None:
        parts.append(f"rev={row.revision}")
    if row.insured:
        parts.append(f"insured={row.insured}")
    if row.lob:
        parts.append(f"lob={row.lob}")
    if row.dol:
        parts.append(f"dol={row.dol.isoformat()}")
    if row.currency_claim:
        parts.append(f"ccy={row.currency_claim}")
    if row.your_share_pct is not None:
        parts.append(f"share={row.your_share_pct}%")
    # Amounts: include only non-zero ones so the line stays compact.
    for k, v in row.amounts.items():
        if v != 0:
            parts.append(f"{k}={_fmt_amount(v)}")
    return ", ".join(parts)


def _render_totals_table(totals: dict[str, dict[str, Decimal]]) -> str:
    """Per-currency totals as a small ASCII-friendly table.

    SOC bordereaux carry seven currencies but only one or two are
    typically non-zero. Show every currency for transparency; the
    zero rows compress visually anyway.
    """
    if not totals:
        return "(no totals row in source)"

    # Collect all amount keys present across currencies for column order.
    keys: list[str] = []
    for amounts in totals.values():
        for k in amounts:
            if k not in keys:
                keys.append(k)

    lines = ["currency: " + " | ".join(keys)]
    for ccy in sorted(totals):
        row = [ccy + ":"]
        for k in keys:
            v = totals[ccy].get(k, Decimal(0))
            row.append(_fmt_amount(v) or "0")
        lines.append("  " + " | ".join(row))
    return "\n".join(lines)


def to_llm_context(result: KBBordereauResult) -> str:
    """Render a :class:`KBBordereauResult` as a single context block
    suitable for paste-in to the Pass-1 prompt.

    The returned string is self-describing — it's safe to drop into
    the existing prompt without other prompt edits, because the
    leading marker line ("[KB deterministic parsing — verified]")
    tells the model how to treat the section.
    """
    rows: Iterable[KBClaimRow] = result.rows[:_MAX_ROWS]
    truncated = len(result.rows) > _MAX_ROWS

    lines: list[str] = [
        "[KB 결정론 파싱 결과 — 이 정보는 검증된 사실입니다]",
        f"문서 종류: {result.sheet_kind} ({result.sheet_name})",
        f"수신자: {result.recipient}",
        f"행 수: {len(result.rows)}"
        + (f" (앞 {_MAX_ROWS}행만 표시)" if truncated else ""),
        "",
        "통화별 합계:",
        _render_totals_table(result.totals_by_currency),
        "",
        "행 (한 행 = 한 줄):",
    ]
    for row in rows:
        lines.append("  " + _row_to_compact_line(row))

    if result.warnings:
        lines.append("")
        lines.append("결정론 파서 경고:")
        for w in result.warnings[:10]:
            lines.append(f"  - {w}")

    return "\n".join(lines)
