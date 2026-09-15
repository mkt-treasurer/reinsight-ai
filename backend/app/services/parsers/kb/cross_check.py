"""Compare deterministic parsing output against the LLM extraction.

The cross-check is read-only and never throws; it returns a
:class:`CrossCheckResult` whose ``severity`` field tells the caller
how loudly to surface the disagreement. Phase 3c uses the result for
audit logging and (in ON mode) optional warning events on the SSE
stream — but the user-facing SOC continues to be produced from the
LLM result regardless.

Severity ladder (from :mod:`workflow_mapping` ``AuditSeverity``):

- ``ok``      — every check matches.
- ``info``    — minor cosmetic differences (e.g. casualty wording).
- ``warning`` — totals disagree within a soft tolerance, ref-set
  drift, or sibling-collapse risk.
- ``fail``    — row count mismatch or hard total mismatch beyond the
  ``epsilon`` tolerance. Phase 3c still proceeds with the LLM result;
  Phase 3d may upgrade this to a hard fail.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from ..kb_bordereau import KBBordereauResult
from .soc_history import _ref_body
from ..ref_no_parser import parse_kb_ref_no
from ..errors import RefNoParseError


# ─── Output type ───────────────────────────────────────────────────────────


SEVERITY_OK = "ok"
SEVERITY_INFO = "info"
SEVERITY_WARNING = "warning"
SEVERITY_FAIL = "fail"

_SEVERITY_ORDER = (SEVERITY_OK, SEVERITY_INFO, SEVERITY_WARNING, SEVERITY_FAIL)


def _max_severity(a: str, b: str) -> str:
    return a if _SEVERITY_ORDER.index(a) >= _SEVERITY_ORDER.index(b) else b


@dataclass
class CrossCheckResult:
    """Structured cross-check output ready for audit logging.

    All numeric fields are populated regardless of severity so a
    downstream report can show side-by-side numbers without re-running
    the comparison.
    """

    deterministic_row_count: int
    llm_row_count: int
    deterministic_totals: dict[str, Decimal]  # flattened currency → claim_amount sum
    llm_totals: dict[str, Decimal]
    epsilon_violated: bool
    severity: str
    mismatch_details: list[dict] = field(default_factory=list)


# ─── Helpers ───────────────────────────────────────────────────────────────


def _sum_deterministic_totals(result: KBBordereauResult) -> dict[str, Decimal]:
    """Flatten ``totals_by_currency`` into per-currency totals of the
    primary 'self' columns (PLA: os_loss_indemnity + os_loss_others +
    os_expense; SOC: paid_loss_indemnity + paid_loss_others + paid_expense).

    The LLM only reports a single ``total_amount_100`` per row, so
    we collapse the deterministic per-column totals to the same
    granularity for comparison.
    """
    out: dict[str, Decimal] = {}
    for ccy, amounts in result.totals_by_currency.items():
        total = Decimal(0)
        for k, v in amounts.items():
            # Skip ceded — LLM total_amount_100 represents 100% (gross).
            if k.startswith("ceded_"):
                continue
            if isinstance(v, Decimal):
                total += v
            else:
                try:
                    total += Decimal(str(v))
                except (InvalidOperation, TypeError):
                    pass
        out[ccy] = total
    return out


def _to_decimal(v: Any) -> Decimal:
    if v is None:
        return Decimal(0)
    if isinstance(v, Decimal):
        return v
    try:
        return Decimal(str(v).replace(",", "")) if v != "" else Decimal(0)
    except (InvalidOperation, TypeError):
        return Decimal(0)


def _llm_per_currency_totals(llm_response: dict) -> dict[str, Decimal]:
    """Group LLM-extracted claim amounts by currency.

    The Pass-1 prompt produces ``claims=[{currency, claim_amount_100,
    expense_100, ...}]``; sum claim+expense per currency to mirror
    what :func:`_sum_deterministic_totals` produced.
    """
    out: dict[str, Decimal] = {}
    claims = llm_response.get("claims") or []
    if not isinstance(claims, list):
        return out
    for c in claims:
        if not isinstance(c, dict):
            continue
        ccy = (c.get("currency") or "").upper() or "WON"
        ca = _to_decimal(c.get("claim_amount_100"))
        ex = _to_decimal(c.get("expense_100"))
        out[ccy] = out.get(ccy, Decimal(0)) + ca + ex
    return out


def _deterministic_ref_set(result: KBBordereauResult) -> set[str]:
    return {
        _ref_body(row.ref_no.key)
        for row in result.rows
        if row.ref_no is not None
    }


def _llm_ref_set(llm_response: dict) -> set[str]:
    out: set[str] = set()
    claims = llm_response.get("claims") or []
    if not isinstance(claims, list):
        return out
    for c in claims:
        if not isinstance(c, dict):
            continue
        raw = c.get("cedant_ref_no") or c.get("ref_no")
        if not raw:
            continue
        try:
            parsed = parse_kb_ref_no(str(raw))
        except RefNoParseError:
            continue
        out.add(_ref_body(parsed.key))
    return out


def _deterministic_casualty_multiset(result: KBBordereauResult) -> Counter:
    return Counter(
        row.casualty for row in result.rows if row.casualty
    )


def _llm_casualty_multiset(llm_response: dict) -> Counter:
    """LLM doesn't currently extract casualty (Phase 3b finding) so
    this typically returns an empty Counter — still implemented so a
    future LLM prompt enrichment can drop in without code changes."""
    out: Counter = Counter()
    claims = llm_response.get("claims") or []
    if not isinstance(claims, list):
        return out
    for c in claims:
        if isinstance(c, dict) and c.get("casualty"):
            out[c["casualty"]] += 1
    return out


# ─── Public entry ──────────────────────────────────────────────────────────


def cross_check(
    deterministic: KBBordereauResult,
    llm_response: dict,
    *,
    epsilon: Decimal = Decimal("0.01"),
) -> CrossCheckResult:
    """Compare every observable axis between the two extractions.

    Severity is the maximum across all checks — one ``fail`` flips the
    whole result to ``fail``. The check details land in
    ``mismatch_details`` as a list of dicts ready for JSON / audit
    logging without further serialisation.
    """
    det_total = len(deterministic.rows)
    llm_total = 0
    if isinstance(llm_response.get("claims"), list):
        llm_total = sum(1 for c in llm_response["claims"] if isinstance(c, dict))

    det_totals = _sum_deterministic_totals(deterministic)
    llm_totals = _llm_per_currency_totals(llm_response)

    severity = SEVERITY_OK
    details: list[dict] = []
    epsilon_violated = False

    # Check 1 — row count.
    if det_total != llm_total:
        severity = _max_severity(severity, SEVERITY_FAIL)
        details.append({
            "check": "row_count",
            "deterministic": det_total,
            "llm": llm_total,
            "severity": SEVERITY_FAIL,
        })

    # Check 2 — per-currency totals.
    all_currencies = set(det_totals) | set(llm_totals)
    for ccy in sorted(all_currencies):
        d = det_totals.get(ccy, Decimal(0))
        l = llm_totals.get(ccy, Decimal(0))
        diff = abs(d - l)
        if diff > epsilon:
            epsilon_violated = True
            # Treat large absolute diffs as fail; small (within ~1%) as warning.
            ref = max(abs(d), abs(l)) or Decimal(1)
            relative = diff / ref
            check_severity = (
                SEVERITY_FAIL if relative > Decimal("0.01") else SEVERITY_WARNING
            )
            severity = _max_severity(severity, check_severity)
            details.append({
                "check": "currency_total",
                "currency": ccy,
                "deterministic": str(d),
                "llm": str(l),
                "diff": str(diff),
                "severity": check_severity,
            })

    # Check 3 — ref set.
    det_refs = _deterministic_ref_set(deterministic)
    llm_refs = _llm_ref_set(llm_response)
    missing_in_llm = det_refs - llm_refs
    extra_in_llm = llm_refs - det_refs
    if missing_in_llm or extra_in_llm:
        severity = _max_severity(severity, SEVERITY_WARNING)
        details.append({
            "check": "ref_set",
            "missing_in_llm": sorted(missing_in_llm),
            "extra_in_llm": sorted(extra_in_llm),
            "severity": SEVERITY_WARNING,
        })

    # Check 4 — casualty multiset (info only — LLM doesn't extract it
    # today, so missing-on-LLM is the rule, not the exception).
    det_cas = _deterministic_casualty_multiset(deterministic)
    llm_cas = _llm_casualty_multiset(llm_response)
    if det_cas and not llm_cas:
        # Expected — LLM prompt doesn't capture casualty. Drop a tiny
        # info note so audit reports can confirm the parsing happened
        # without flagging it as a real disagreement.
        details.append({
            "check": "casualty",
            "note": "deterministic captured casualty; LLM has none — expected",
            "deterministic_distinct": len(det_cas),
            "severity": SEVERITY_INFO,
        })
    elif det_cas != llm_cas and llm_cas:
        # LLM extracted some casualty values but they don't match —
        # surface as info; future prompt enrichment can lift this.
        severity = _max_severity(severity, SEVERITY_INFO)
        details.append({
            "check": "casualty",
            "deterministic_distinct": sorted(det_cas),
            "llm_distinct": sorted(llm_cas),
            "severity": SEVERITY_INFO,
        })

    return CrossCheckResult(
        deterministic_row_count=det_total,
        llm_row_count=llm_total,
        deterministic_totals=det_totals,
        llm_totals=llm_totals,
        epsilon_violated=epsilon_violated,
        severity=severity,
        mismatch_details=details,
    )
