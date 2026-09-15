"""Shared helpers for the SOC generator / stream routers.

Extracted to kill duplication between `routers/soc_generator.py` and
`routers/soc_stream.py`. Behavior-preserving — each helper mirrors the
version that lived in-line in those files.
"""

from __future__ import annotations

import json


# ─── Broker aliases ────────────────────────────────────────────────────────
# Our own broker name appears in cedant files under several spellings (OCR
# artifacts, legacy names). None of these are reinsurers and must never end
# up in the SOC output.
BROKER_ALIASES: frozenset[str] = frozenset({
    "ins corp", "ins corp.", "ins",
    "ns corp", "ns corp.", "ns",
    "daewoo ins", "daewoo ins corp", "daewoo ins corp.",
    "daewoo insurance", "dwins",
})


# Cedant short codes. Keys are substrings matched case-insensitively against
# the free-text cedant name returned by the AI.
CEDANT_FULL_TO_CODE: dict[str, str] = {
    "korean reinsurance": "KR",
    "korean re": "KR",
    "hanwha": "HW",
    "samsung": "SS",
    "db": "DB",
    "meritz": "MZ",
    "heungkuk": "HK",
    "kb": "KB",
}


# ─── JSON / number parsing ─────────────────────────────────────────────────

def parse_json(raw: str, *, unwrap_list: bool = False):
    """Strip ```json fences and parse. Returns None on failure.

    When unwrap_list=True, a list response is collapsed to its first element
    (matches soc_stream's original behavior).
    """
    raw = (raw or "").strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        result = json.loads(raw)
    except Exception:
        return None
    if unwrap_list and isinstance(result, list):
        return result[0] if result else None
    return result


def to_num(v) -> float:
    """Parse a possibly-formatted Korean money value to float.

    Handles: "1,234", "(5,000)" → -5000, "△5,000" → -5000, None → 0.0.
    """
    if v is None or v == "":
        return 0.0
    s = str(v).replace(",", "").replace(" ", "").strip()
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    if s.startswith("△") or s.startswith("▲"):
        s = "-" + s[1:]
    try:
        return float(s)
    except Exception:
        return 0.0


def fmt_amount(ccy: str, amount: float) -> str:
    if ccy == "KRW":
        return f"{ccy} {amount:,.0f}"
    return f"{ccy} {amount:,.2f}"


# ─── Value quality / extraction merging ────────────────────────────────────

_LOW_QUALITY_VALUES: frozenset[str] = frozenset({
    "-", "null", "none", "",
    "refer to the list", "settlement request", "n/a",
    "insured", "reinsured", "korean 1 sentence",
}) | BROKER_ALIASES


def is_low_quality(val) -> bool:
    """True if a field value is placeholder / broker noise / empty."""
    if not val:
        return True
    return str(val).strip().lower() in _LOW_QUALITY_VALUES


def is_broker_name(name: str) -> bool:
    """True if `name` is one of our own broker aliases (case-insensitive)."""
    return (name or "").strip().lower() in BROKER_ALIASES


_CORP_SUFFIX_RE = __import__("re").compile(
    r"[,.\s]*(co\.?\s*,?\s*ltd\.?|company\s+limited|corp\.?|corporation|inc\.?|incorporated|limited|ltd\.?|llc|plc|gmbh|ag|sa|pty)\.?\s*$",
    __import__("re").IGNORECASE,
)


def strip_corp_suffix(name: str) -> str:
    """Strip legal-entity suffixes (CO.,LTD / CORP / INC / LIMITED ...) from a name.

    Applied repeatedly so e.g. "POSCO DX CO., LTD." → "POSCO DX". Used for
    broader ILIKE matching when the AI-extracted name is long-form but the DB
    stores the short form (or vice versa).
    """
    s = (name or "").strip()
    while True:
        new = _CORP_SUFFIX_RE.sub("", s).strip(" ,.")
        if new == s or not new:
            return s if not new else new
        s = new


def normalize_cedant(raw: str) -> str:
    """Map a free-text cedant name to a 2-letter code when possible."""
    low = (raw or "").strip().lower()
    for full, abbr in CEDANT_FULL_TO_CODE.items():
        if full in low:
            return abbr
    return raw or ""


# ─── Insured-name resolution ───────────────────────────────────────────────
#
# Cedants (notably KB) deliver SOC PDFs with the Insured field masked
# ("신****인"). We never want this masked form on a slip — it must be
# resolved from past_claims / contracts / policy / claimant before display.
# When the slip is going to a foreign reinsurer we additionally want the
# English form, which contracts.assured frequently carries inline as
# bilingual text (e.g. "Korea South-East Power Co., Ltd. (한국남동발전)").

import re as _re_iname

_HANGUL_CHAR_RE = _re_iname.compile(r"[가-힣ㄱ-ㆎ]")
_TRAILING_KO_PAREN_RE = _re_iname.compile(r"\s*\([^()]*[가-힣ㄱ-ㆎ][^()]*\)\s*$")
_LEADING_KO_PREFIX_RE = _re_iname.compile(r"^[\s가-힣ㄱ-ㆎ·\-\s]+\(([^()]+)\)\s*$")


def _has_hangul(s: str) -> bool:
    return bool(s) and _HANGUL_CHAR_RE.search(s) is not None


def _is_masked(s: str) -> bool:
    return bool(s) and "*" in s


def resolve_insured_name(
    raw: str,
    *,
    claimant: str = "",
    past_claims: list[dict] | None = None,
    contracts: list[dict] | None = None,
    policy: dict | None = None,
) -> tuple[str, str]:
    """Return (display_name, source_tag).

    If `raw` is masked (contains '*'), walk the candidate sources in priority
    order and return the first non-masked, non-empty hit. If `raw` is already
    clean, return it unchanged with source 'raw'.

    Priority: past_claims[*].account_name → contracts[*].assured →
              policy.assured → claimant → raw (unchanged).
    """
    if not _is_masked(raw):
        return (raw or "", "raw")

    for d in (past_claims or []):
        cand = (d.get("account_name") or "").strip()
        if cand and not _is_masked(cand):
            return cand, "past_claims"

    for d in (contracts or []):
        cand = (d.get("assured") or "").strip()
        if cand and not _is_masked(cand):
            return cand, "contracts"

    if policy:
        cand = (policy.get("assured") or "").strip()
        if cand and not _is_masked(cand):
            return cand, "policy"

    cand = (claimant or "").strip()
    if cand and not _is_masked(cand):
        return cand, "claimant"

    return (raw or "", "unresolved")


def english_form_of_insured(name: str) -> str:
    """Strip a trailing/leading Korean parenthetical to expose the English form.

    Handles the two common bilingual shapes seen in `Contract.assured`:

      "Korea South-East Power Co., Ltd. (한국남동발전)"  → "Korea South-East Power Co., Ltd."
      "한국남동발전 (Korea South-East Power Co., Ltd.)" → "Korea South-East Power Co., Ltd."

    Returns "" when the name is Korean-only (no English to extract) and
    returns the input unchanged when it is already pure English.
    """
    s = (name or "").strip()
    if not s:
        return ""

    if not _has_hangul(s):
        return s

    stripped = _TRAILING_KO_PAREN_RE.sub("", s).strip()
    if stripped and not _has_hangul(stripped):
        return stripped

    m = _LEADING_KO_PREFIX_RE.match(s)
    if m:
        inner = m.group(1).strip()
        if inner and not _has_hangul(inner):
            return inner

    return ""


def pick_english_insured_name(
    raw: str,
    *,
    contracts: list[dict] | None = None,
    policy: dict | None = None,
) -> tuple[str, str]:
    """Return (english_name, source_tag) — empty string when no DB-backed
    English form is available (caller should then trigger LLM translation).

    Strategy: try the user's current `raw`, then walk contracts.assured /
    policy.assured looking for any candidate that yields a clean English
    string via `english_form_of_insured`.
    """
    cand = english_form_of_insured(raw)
    if cand:
        return cand, "raw"

    for d in (contracts or []):
        cand = english_form_of_insured((d.get("assured") or ""))
        if cand:
            return cand, "contracts"

    if policy:
        cand = english_form_of_insured((policy.get("assured") or ""))
        if cand:
            return cand, "policy"

    return "", "none"


# ─── Evidence row serializers (for UI + prompt inclusion) ──────────────────

def claim_to_dict(cl) -> dict:
    return {
        "id": cl.id,
        "ref_no": cl.ref_no,
        "account_name": cl.account_name,
        "cedant": cl.cedant,
        "reinsurer": cl.reinsurer,
        "share": float(cl.share or 0),
        "krw_amount": float(cl.krw_amount or 0),
        "dol": cl.dol.isoformat() if getattr(cl, "dol", None) else None,
        "line": getattr(cl, "line", None),
        "usd_amount": float(getattr(cl, "usd_amount", 0) or 0) if getattr(cl, "usd_amount", None) else None,
        "nature_of_loss": getattr(cl, "nature_of_loss", None),
    }


def contract_to_dict(c) -> dict:
    return {
        "id": c.id,
        "cover_note_no": c.cover_note_no,
        "assured": c.assured,
        "cedant": c.cedant,
        "reinsurer": c.reinsurer,
        "share": float(c.share or 0),
        "line": c.line,
        "year": c.year,
        "period_from": c.period_from.isoformat() if getattr(c, "period_from", None) else None,
        "period_to": c.period_to.isoformat() if getattr(c, "period_to", None) else None,
        "currency": getattr(c, "currency", None),
        "gross_prem_100": float(c.gross_prem_100) if getattr(c, "gross_prem_100", None) else None,
        "ri_prem": float(c.ri_prem) if getattr(c, "ri_prem", None) else None,
        "workflow_status": getattr(c, "workflow_status", None),
    }


def fmt_claim(d: dict) -> str:
    return (
        f"ref={d['ref_no']} | 피보험자={d['account_name']} | 원수사(cedant)={d['cedant'] or '-'} | "
        f"재보험사(reinsurer)={d['reinsurer'] or '-'} | share={d['share']:.2%} | "
        f"KRW {d['krw_amount']:,.0f}"
    )


def fmt_contract(d: dict) -> str:
    return f"{d['cover_note_no']} | {d['assured']} | {d['reinsurer']} | share={d['share']:.2%} | line={d['line']}"
