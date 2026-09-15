"""Backend port of the frontend testbench's per-field diff classifier.

The slip-testbench compare page (`frontend/.../slip-testbench/page.tsx`)
runs `buildDiff` + `classifyDiff` over `ExtractedFields` to colour the
side-by-side table. For persisted runs we need to recompute the same
labels server-side so accuracy numbers, severity counts, and VLM
prompts agree with the live UI.

Severity weighting (used for ``weighted_accuracy``):

    match   1.0    minor   0.7
    major   0.0    missing 0.0

A "minor" still counts as 0.7 because cedant-facing review treats
"Co., Ltd." truncation or case differences as visually noticeable but
materially identical.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable

# Fields compared between ground_truth and generated. Keep the order
# stable — the frontend renders rows in this order and accuracy
# aggregates per-field over time.
FIELDS: tuple[tuple[str, str], ...] = (
    ("Insured", "account_name"),
    ("Reinsured", "reinsured"),
    ("Line", "line"),
    ("Ref No", "ref_no"),
    ("Date of Loss", "dol"),
    ("Doc Date", "doc_date"),
    ("Title Subline", "title_subline"),
    ("Policy Period", "policy_period"),
    ("Currency", "currency"),
    ("Total Amount", "total_amount"),
    ("Expenses Reserve", "expenses_reserve"),
    ("Location of Loss", "location_of_loss"),
    ("Nature of Loss", "nature_of_loss"),
    ("Particulars", "particulars"),
    ("Remarks", "remarks"),
)

NUMERIC_KEYS: frozenset[str] = frozenset({"total_amount", "expenses_reserve"})

SEVERITY_WEIGHTS: dict[str, float] = {
    "match": 1.0,
    "minor": 0.7,
    "major": 0.0,
    "missing": 0.0,
}

HANGUL_RE = re.compile(r"[\u3130-\u318F\uAC00-\uD7AF]")


@dataclass(frozen=True)
class FieldDiff:
    label: str
    key: str
    original: str  # ground_truth value, stringified
    generated: str
    severity: str  # 'match' | 'minor' | 'major' | 'missing'
    note: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "key": self.key,
            "original": self.original,
            "generated": self.generated,
            "severity": self.severity,
            "note": self.note,
        }


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def _as_float(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def classify(
    key: str, orig: Any, gen: Any
) -> tuple[str, str | None]:
    """Return ``(severity, note)`` for a single field. Mirrors
    ``classifyDiff`` in the frontend testbench."""
    o = "" if orig is None else str(orig)
    g = "" if gen is None else str(gen)

    if key in NUMERIC_KEYS:
        on = _as_float(orig)
        gn = _as_float(gen)
        if on == 0 and gn == 0 and not o and not g:
            return "match", None
        if on == gn:
            return "match", None
        diff = abs(on - gn)
        pct = diff / abs(on) if on else 1.0
        if pct < 0.001:
            return "minor", "rounding"
        return "major", f"Δ {diff:,.0f}"

    if not o and not g:
        return "match", None
    if o and not g:
        return "missing", "generated empty"
    if not o and g:
        return "missing", "original empty"
    if o == g:
        return "match", None

    on_s = _norm(o)
    gn_s = _norm(g)
    if on_s == gn_s:
        return "minor", "case/whitespace"
    if on_s in gn_s or gn_s in on_s:
        return "minor", "wrap"

    o_hangul = bool(HANGUL_RE.search(o))
    g_hangul = bool(HANGUL_RE.search(g))
    if o_hangul != g_hangul:
        note = (
            "original Korean → generated English"
            if o_hangul
            else "original English → generated Korean"
        )
        return "major", note
    return "major", None


def build_diff(
    gt: dict[str, Any], gen: dict[str, Any]
) -> list[FieldDiff]:
    out: list[FieldDiff] = []
    for label, key in FIELDS:
        sev, note = classify(key, gt.get(key), gen.get(key))
        out.append(
            FieldDiff(
                label=label,
                key=key,
                original="" if gt.get(key) is None else str(gt.get(key)),
                generated="" if gen.get(key) is None else str(gen.get(key)),
                severity=sev,
                note=note,
            )
        )
    return out


def severity_counts(diffs: Iterable[FieldDiff]) -> dict[str, int]:
    counts = {"match": 0, "minor": 0, "major": 0, "missing": 0}
    for d in diffs:
        counts[d.severity] = counts.get(d.severity, 0) + 1
    return counts


def weighted_accuracy(diffs: Iterable[FieldDiff]) -> float:
    items = list(diffs)
    if not items:
        return 0.0
    total = sum(SEVERITY_WEIGHTS.get(d.severity, 0.0) for d in items)
    return round(total / len(items), 4)
