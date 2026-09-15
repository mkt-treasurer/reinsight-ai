"""Phase 3c — cedant detector for the deterministic-parser entry path.

Decides whether an uploaded xlsx looks confidently like a KB
bordereau. Only confident matches escape into the deterministic
pipeline; everything else falls back to the legacy LLM-only flow so
KR / HW / SS / DB / HM documents are guaranteed not to regress.

Two-tier confidence policy (Step 1 decision):

- ``confidence ≥ 0.98`` → ``decision="auto"`` — proceed without extra
  audit traffic. Reserved for headers that match KB's exact column
  layout or a sheet+letterhead combo that's unique to KB.
- ``0.95 ≤ confidence < 0.98`` → ``decision="auto_with_audit"`` —
  proceed but emit an extra log line so operators can review the
  borderline cases.
- ``confidence < 0.95`` → ``decision="fallback"`` — LLM-only path.

False positives are far worse than false negatives here. A false
negative just means we miss out on a deterministic boost for one
file; a false positive could send a non-KB document through the KB
parser and either fail noisily (no harm) or corrupt downstream
matching (worst case). The thresholds are tuned for the former.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional


# ─── Output type ───────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CedantHint:
    """Detector verdict.

    ``cedant`` is set only when the verdict is confident enough to
    drive a deterministic path; otherwise it stays ``None`` and the
    caller must use the LLM fallback. ``signals`` is the audit trail —
    every contributing signal name lands here so an operator can
    reconstruct the decision from the log.
    """

    cedant: Optional[str]
    confidence: float
    signals: tuple[str, ...]
    decision: str  # "auto" | "auto_with_audit" | "fallback"


# ─── Signal table ──────────────────────────────────────────────────────────


# Each entry: (signal_name, predicate, weight). Predicates take the
# already-extracted view of the file and return True when the signal
# fires. Weights are not summed — we take the max — but they form the
# canonical ordering for the audit trail.
_KB_SHEET_NAMES = frozenset({"OS List", "SOC"})
_KB_LETTERHEAD_TOKENS = ("KB Insurance", "KB INSURANCE")
_KB_RECIPIENT_TOKENS = ("인스보험중개", "DAEWOO INS")
# Token boundary that treats ``_`` and ``.`` as boundaries too —
# ``\b`` alone counts ``_`` as a word char which would miss the very
# common ``KB_export_...xlsx`` and ``...KB.pdf`` cases.
_KB_FILENAME_KB_RE = re.compile(r"(?<![A-Za-z0-9])KB(?![A-Za-z0-9])", re.IGNORECASE)
_KB_FILENAME_FAC_INS_RE = re.compile(r"FAC[_\s-]*INS", re.IGNORECASE)


def _has_kb_ref_header(header_text: Optional[str]) -> bool:
    """The KB column header literally contains both ``접수번호`` and
    ``KB Ref`` together. No other cedant in production data uses both
    tokens, so this is the strongest single signal."""
    if not header_text:
        return False
    return "접수번호" in header_text and "KB Ref" in header_text


def _has_kb_sheet(sheet_names: Optional[Iterable[str]]) -> bool:
    if not sheet_names:
        return False
    return any(s in _KB_SHEET_NAMES for s in sheet_names)


def _has_letterhead(header_text: Optional[str]) -> bool:
    if not header_text:
        return False
    return any(tok in header_text for tok in _KB_LETTERHEAD_TOKENS)


def _has_recipient(header_text: Optional[str]) -> bool:
    if not header_text:
        return False
    return any(tok in header_text for tok in _KB_RECIPIENT_TOKENS)


def _has_kb_filename(file_path: str) -> bool:
    name = Path(file_path).name
    return bool(_KB_FILENAME_KB_RE.search(name))


def _has_fac_ins_filename(file_path: str) -> bool:
    name = Path(file_path).name
    return bool(_KB_FILENAME_FAC_INS_RE.search(name))


# ─── Public detector ───────────────────────────────────────────────────────


def detect_cedant(
    file_path: str,
    sheet_names: Optional[Iterable[str]] = None,
    header_text: Optional[str] = None,
) -> CedantHint:
    """Score the input against KB-specific signals and decide whether
    the deterministic parser should run.

    The caller supplies what's cheap to obtain at the
    ``soc_stream.py`` integration point: the temp file path, the
    list of sheet names from a quick ``load_workbook`` call, and a
    concatenation of the first ~25 header-area cell values (joined
    by spaces) for substring matching.
    """
    signals: list[str] = []
    confidence = 0.0

    sheet_match = _has_kb_sheet(sheet_names)
    letterhead = _has_letterhead(header_text)
    recipient = _has_recipient(header_text)
    fname_kb = _has_kb_filename(file_path)
    fname_fac = _has_fac_ins_filename(file_path)

    # Tier 1 — definitive header.
    if _has_kb_ref_header(header_text):
        signals.append("kb_ref_header")
        confidence = max(confidence, 1.00)

    # Tier 2 — sheet + strong corroboration.
    if sheet_match and letterhead:
        signals.append("kb_sheet+letterhead")
        confidence = max(confidence, 0.99)
    if sheet_match and recipient:
        signals.append("kb_sheet+recipient")
        confidence = max(confidence, 0.98)

    # Tier 3 — sheet + weak corroboration (borderline; needs audit).
    if sheet_match and fname_kb:
        signals.append("kb_sheet+filename_kb")
        confidence = max(confidence, 0.97)
    if sheet_match and fname_fac:
        signals.append("kb_sheet+filename_fac_ins")
        confidence = max(confidence, 0.96)

    # Tier 4 — weak signals on their own. Confidence stays below 0.95
    # so they fall through to the LLM fallback regardless.
    if sheet_match:
        signals.append("kb_sheet_only")
        confidence = max(confidence, 0.60)
    if fname_kb:
        signals.append("kb_filename_only")
        confidence = max(confidence, 0.70)

    if confidence >= 0.98:
        return CedantHint(
            cedant="KB", confidence=confidence,
            signals=tuple(signals), decision="auto",
        )
    if confidence >= 0.95:
        return CedantHint(
            cedant="KB", confidence=confidence,
            signals=tuple(signals), decision="auto_with_audit",
        )
    return CedantHint(
        cedant=None, confidence=confidence,
        signals=tuple(signals), decision="fallback",
    )
