"""Calculation-basis (산출기초) consistency REFERENCE DB for the placement
RQ-slip extractor (insightre.ai Facultative placement track).

A small, self-contained reference dataset + verification pass that strengthens
the M3 data-consistency check. The Gemini prompt detects cross-document
conflicts in free text; this module NORMALIZES the values it reports into a
canonical ``(amount, currency)`` form so unit/currency mismatches are caught and
*quantified* deterministically rather than left to LLM judgement.

The headline case: a cedent states annual turnover as ``USD 475,365,023.10`` on
the RQ but ``7,000억원`` on the questionnaire. Naively that reads as a
discrepancy — but 7,000억원 = 700,000,000,000 KRW reconciles to that USD figure
at ≈1,473 KRW/USD, a plausible FX rate. The reference layer computes the implied
rate and tells the operator it is most likely a *notation* difference to verify,
not a real magnitude error. A genuine 3× gap, by contrast, is escalated.

Stateless and isolated like the rest of the rq-slip feature: pure functions, no
DB, no I/O. Editing this file cannot affect the claims/SOC pipeline.
"""

from __future__ import annotations

import re
from typing import Optional, TypedDict


# ── Reference DB ──────────────────────────────────────────────────────────
# 산출기초 (calculation-basis) — the items whose values must AGREE across the
# cedent's documents for the quoted rate to be sound. Used to decide which
# reported discrepancies get the money-normalization treatment.
CALC_BASIS_FIELDS: dict[str, dict[str, str]] = {
    "annual_turnover": {"ko": "연간매출액", "en": "Annual Turnover", "type": "money"},
    "limit_of_liability": {"ko": "보상한도액", "en": "Limit of Liability", "type": "money"},
    "sum_insured": {"ko": "보험가입금액", "en": "Sum Insured", "type": "money"},
    "deductible": {"ko": "공제금액", "en": "Deductible", "type": "money"},
    "premium": {"ko": "보험료", "en": "Premium", "type": "money"},
    "policy_period": {"ko": "보험기간", "en": "Policy Period", "type": "period"},
    "insured": {"ko": "피보험자", "en": "Insured", "type": "text"},
}

# Substrings that mark a discrepancy's ``field`` as a money calc-basis item
# (matched case-insensitively against both the Korean and English names).
MONEY_FIELD_MARKERS: tuple[str, ...] = (
    "turnover", "매출", "limit", "한도", "deductible", "공제",
    "sum", "가입금액", "premium", "보험료", "insured amount",
)

# Korean numeric-unit reference → multiplier in base currency units (₩1 / $1).
# Ordered longest-first for greedy matching. The bare "백"(=100) is deliberately
# EXCLUDED: in KR insurance shorthand "76백" means 76 백만원, so a bare 백 is
# ambiguous; calc-basis amounts are always written with explicit 억/만/백만.
KRW_UNITS: tuple[tuple[str, int], ...] = (
    ("조", 1_0000_0000_0000),
    ("억", 1_0000_0000),
    ("천만", 1000_0000),
    ("백만", 100_0000),
    ("십만", 10_0000),
    ("만", 1_0000),
    ("천", 1000),
)

# Plausible KRW-per-USD band for UY2025–2026. A cross-currency pair whose implied
# rate lands inside this band is flagged "reconcilable" (likely a notation
# difference to verify); outside it is a real magnitude mismatch.
FX_PLAUSIBLE_KRW_PER_USD: tuple[float, float] = (900.0, 1700.0)

# Same-currency relative tolerance under which two amounts are treated as equal.
SAME_CCY_TOLERANCE = 0.01


class NormAmount(TypedDict):
    raw: str
    amount: Optional[float]
    currency: Optional[str]
    unit: Optional[str]


def detect_currency(s: str) -> Optional[str]:
    """Best-effort currency of a money string. Korean unit words imply KRW."""
    u = s.upper()
    if "USD" in u or "US$" in u or "$" in s:
        return "USD"
    if "KRW" in u or "₩" in s or "원" in s:
        return "KRW"
    if any(unit in s for unit, _ in KRW_UNITS):
        return "KRW"
    return None


def normalize_amount(text: Optional[str]) -> Optional[NormAmount]:
    """Parse a Korean/English money string into a canonical amount + currency.

    Takes the FIRST numeric token as the headline figure (lists/ranges keep
    their lead value) and applies any Korean unit immediately following it.
    Returns ``None`` when there is no parseable number.

    >>> normalize_amount("7,000억원")["amount"]
    700000000000.0
    >>> normalize_amount("USD 475,365,023.10")["currency"]
    'USD'
    """
    if not text or not str(text).strip():
        return None
    raw = str(text).strip()
    currency = detect_currency(raw)
    m = re.search(r"\d[\d,]*\.?\d*", raw)
    if not m:
        return {"raw": raw, "amount": None, "currency": currency, "unit": None}
    num = float(m.group(0).replace(",", ""))
    tail = raw[m.end():m.end() + 4].lstrip()
    unit: Optional[str] = None
    mult = 1
    for token, factor in KRW_UNITS:
        if tail.startswith(token):
            unit, mult = token, factor
            currency = currency or "KRW"
            break
    return {"raw": raw, "amount": num * mult, "currency": currency, "unit": unit}


class CompareResult(TypedDict):
    verdict: str  # match | reconcilable | mismatch | unknown
    note: str
    rate: Optional[float]
    ratio: Optional[float]


def compare_amounts(a: Optional[NormAmount], b: Optional[NormAmount]) -> CompareResult:
    """Compare two normalized amounts, reconciling across currencies via the
    implied FX rate. Never decides for the operator — annotates so a human
    confirms (human-in-the-loop)."""
    blank: CompareResult = {"verdict": "unknown", "note": "", "rate": None, "ratio": None}
    if not a or not b or a["amount"] is None or b["amount"] is None:
        return blank
    ca, cb = a["currency"], b["currency"]

    if ca and cb and ca != cb:
        krw = a if ca == "KRW" else b
        usd = a if ca == "USD" else b
        if not usd["amount"]:
            return {**blank, "note": "통화가 달라 직접 비교 불가"}
        rate = krw["amount"] / usd["amount"]
        lo, hi = FX_PLAUSIBLE_KRW_PER_USD
        if lo <= rate <= hi:
            return {
                "verdict": "reconcilable", "rate": rate, "ratio": None,
                "note": f"통화 표기 차이 — 환율 약 {rate:,.0f} KRW/USD로 환산 시 실질 동일 추정(검토 필요)",
            }
        return {
            "verdict": "mismatch", "rate": rate, "ratio": None,
            "note": f"통화·금액 불일치 — 환산 환율 {rate:,.0f} KRW/USD는 비현실적, 실제 금액 차이로 보임",
        }

    # Same (or unknown-but-equal) currency.
    hi = max(a["amount"], b["amount"])
    lo = min(a["amount"], b["amount"])
    if hi == 0:
        return {**blank, "verdict": "match", "note": "정규화 후 동일(0)"}
    if (hi - lo) / hi <= SAME_CCY_TOLERANCE:
        return {**blank, "verdict": "match", "note": "정규화 후 동일"}
    ratio = hi / lo if lo else None
    note = f"정규화 후 약 {ratio:.2f}배 차이" if ratio else "정규화 후 금액 불일치"
    return {"verdict": "mismatch", "note": note, "rate": None, "ratio": ratio}


# Severity assigned by the reference layer per reconciliation verdict.
_SEVERITY_BY_VERDICT = {"match": "low", "reconcilable": "medium", "mismatch": "high"}


def enrich_discrepancies(extracted: dict) -> dict:
    """Return a NEW extraction dict whose money discrepancies are annotated with
    the reference-DB normalization verdict (and severity re-graded). Non-money
    discrepancies pass through untouched. Immutable — never mutates the input."""
    discs = extracted.get("discrepancies") or []
    if not discs:
        return extracted

    enriched: list[dict] = []
    for d in discs:
        d2 = dict(d)
        field = (d.get("field") or "").lower()
        if any(marker in field for marker in MONEY_FIELD_MARKERS):
            result = compare_amounts(
                normalize_amount(d.get("rq_value")),
                normalize_amount(d.get("other_value")),
            )
            if result["verdict"] != "unknown" and result["note"]:
                base = d.get("note") or ""
                d2["note"] = (f"{base} · " if base else "") + f"[참고DB] {result['note']}"
                d2["severity"] = _SEVERITY_BY_VERDICT.get(result["verdict"], d.get("severity") or "medium")
        enriched.append(d2)

    return {**extracted, "discrepancies": enriched}
