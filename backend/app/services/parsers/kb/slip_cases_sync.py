"""Phase 3b — read-only adapter that pulls KB SOC partial keys out
of ``slip_cases.extracted`` JSONB and feeds them into a
:class:`SOCHistory`.

The JSONB schema produced by the live SOC pipeline does not carry
casualty / item_serial / cession_serial, so we cannot reconstruct the
Phase-2 5-tuple base key. The adapter records what's available
(``recipient`` heuristic + ``ref_body`` + ``revision``) on the
``SOCHistory`` partial tier and **does not** modify Phase-2 strict
matching. Audit code can consult the partial tier via
:meth:`SOCHistory.has_seen_at_ref_level` for ref-level questions.

This module is **read-only** with respect to the database — the
adapter constructor accepts a session for forward compatibility, but
no UPDATE / INSERT path exists in Phase 3b.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

from ..errors import RefNoParseError
from ..ref_no_parser import parse_kb_ref_no
from .soc_history import (
    QUALITY_EXACT,
    QUALITY_INFERRED,
    QUALITY_ORDER,
    QUALITY_PARTIAL,
    SOCHistory,
    _ref_body,
)


# ─── Recipient heuristic ───────────────────────────────────────────────────


# Default recipient when no DAEWOO marker is found in the source
# filename. Matches the production INS sheet's ``To :`` value so the
# resulting partial keys can join cleanly against bordereau-tier keys.
DEFAULT_INS_RECIPIENT = "인스보험중개, SEOUL, KOREA"
DAEWOO_RECIPIENT = "DAEWOO INS"


def _infer_recipient(input_files: Optional[list]) -> str:
    """Best-effort recipient detection from ``input_files`` filenames.

    KB sends DAEWOO and INS as physically separate xlsx files; the
    filename usually contains ``DAEWOO`` for the former and is plain
    otherwise. When no input_files are recorded (older slip_cases
    rows) or none mention DAEWOO, fall back to the INS recipient.
    """
    if not input_files:
        return DEFAULT_INS_RECIPIENT
    for f in input_files:
        if not isinstance(f, dict):
            continue
        name = str(f.get("name") or "").upper()
        if "DAEWOO" in name:
            return DAEWOO_RECIPIENT
    return DEFAULT_INS_RECIPIENT


# ─── Output types ──────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ExtractedKey:
    """One partial key extracted from a slip_cases row."""

    slip_case_id: str
    recipient: str
    ref_body: str
    revision: Optional[int]
    quality: str


@dataclass
class SlipCasesSyncReport:
    """Summary of one :meth:`SlipCasesAdapter.populate` run."""

    total_slip_cases: int = 0
    extracted_keys: int = 0
    quality_breakdown: dict[str, int] = field(default_factory=dict)
    skipped: list[dict] = field(default_factory=list)
    admitted_to_history: int = 0


# ─── Quality grading ───────────────────────────────────────────────────────


def _grade(
    recipient: Optional[str],
    ref_body: Optional[str],
    revision: Optional[int],
) -> Optional[str]:
    """Decide a quality grade for one extracted partial key.

    The slip_cases JSONB schema can never satisfy ``exact`` (5-tuple
    complete) — casualty / item_serial / cession_serial are not in
    the prompt's output. ``partial`` is the best-case grade.
    """
    if not ref_body:
        return None
    if recipient and revision is not None:
        return QUALITY_PARTIAL
    return QUALITY_INFERRED


def _quality_meets_threshold(grade: str, threshold: str) -> bool:
    """``threshold='partial'`` admits exact + partial; ``'inferred'``
    admits everything; ``'exact'`` admits only exact (currently 0%
    of slip_cases — kept for forward compatibility)."""
    return QUALITY_ORDER.index(grade) <= QUALITY_ORDER.index(threshold)


# ─── Extraction ────────────────────────────────────────────────────────────


def _parse_one_ref(raw_ref: str) -> Optional[tuple[str, Optional[int]]]:
    """Parse a single ref string and return ``(ref_body, revision)``,
    or ``None`` if the ref doesn't fit any KB shape we recognise."""
    raw_ref = (raw_ref or "").strip()
    if not raw_ref:
        return None
    try:
        parsed = parse_kb_ref_no(raw_ref)
    except RefNoParseError:
        return None
    return _ref_body(parsed.key), parsed.revision


def _extract_from_claims_array(
    slip_case_id: str,
    recipient: str,
    claims: list[Any],
) -> tuple[list[ExtractedKey], list[str]]:
    """Pull partial keys out of ``extracted.claims[]`` (the multi-row
    bordereau-style shape). Returns ``(keys, skip_reasons)``."""
    keys: list[ExtractedKey] = []
    reasons: list[str] = []
    for i, claim in enumerate(claims):
        if not isinstance(claim, dict):
            reasons.append(f"claims[{i}] is not a dict")
            continue
        # ``cedant_ref_no`` is the per-row ref number with revision
        # suffix; ``ref_no`` (top-level only) is the case-level ref.
        raw_ref = claim.get("cedant_ref_no") or claim.get("ref_no")
        if not raw_ref:
            reasons.append(f"claims[{i}] missing cedant_ref_no")
            continue
        parsed = _parse_one_ref(str(raw_ref))
        if parsed is None:
            reasons.append(f"claims[{i}] unparseable ref_no={raw_ref!r}")
            continue
        ref_body, revision = parsed
        grade = _grade(recipient, ref_body, revision)
        if grade is None:
            reasons.append(f"claims[{i}] could not grade")
            continue
        keys.append(ExtractedKey(
            slip_case_id=slip_case_id,
            recipient=recipient,
            ref_body=ref_body,
            revision=revision,
            quality=grade,
        ))
    return keys, reasons


def _extract_from_top_level_ref(
    slip_case_id: str,
    recipient: str,
    raw_ref: str,
) -> tuple[list[ExtractedKey], list[str]]:
    """Fallback: pull from ``extracted.ref_no`` only (single-claim
    shape). Comma-separated forms like ``"...001, ...002"`` are split
    and each component is parsed individually."""
    keys: list[ExtractedKey] = []
    reasons: list[str] = []
    parts = [p.strip() for p in raw_ref.split(",") if p.strip()]
    if not parts:
        return keys, [f"top-level ref_no empty after split: {raw_ref!r}"]
    for part in parts:
        parsed = _parse_one_ref(part)
        if parsed is None:
            reasons.append(f"top-level ref_no part unparseable: {part!r}")
            continue
        ref_body, revision = parsed
        grade = _grade(recipient, ref_body, revision)
        if grade is None:
            reasons.append(f"top-level ref_no part could not grade: {part!r}")
            continue
        keys.append(ExtractedKey(
            slip_case_id=slip_case_id,
            recipient=recipient,
            ref_body=ref_body,
            revision=revision,
            quality=grade,
        ))
    return keys, reasons


def extract_keys_from_slip_case(slip_case: dict) -> tuple[list[ExtractedKey], list[str]]:
    """Extract zero or more partial keys from one slip_cases row.

    Defensive against LLM output drift: missing fields, wrong types,
    malformed refs are all silently skipped with a reason recorded
    for the audit report.

    The row is expected to look like ``{"id": str|UUID, "extracted":
    {...}, "input_files": [...], ...}``. Anything else returns no
    keys and one or more skip reasons.
    """
    slip_case_id = str(slip_case.get("id") or "?")
    extracted = slip_case.get("extracted")
    if not isinstance(extracted, dict):
        return [], ["extracted is missing or not a dict"]

    if extracted.get("cedant") != "KB":
        return [], [f"non-KB cedant: {extracted.get('cedant')!r}"]

    recipient = _infer_recipient(slip_case.get("input_files"))

    # Prefer the multi-row claims[] form; it carries per-row revisions.
    claims = extracted.get("claims")
    if isinstance(claims, list) and claims:
        return _extract_from_claims_array(slip_case_id, recipient, claims)

    # Fall back to the single top-level ref_no.
    raw_ref = extracted.get("ref_no")
    if not raw_ref:
        return [], ["no claims[] and no top-level ref_no"]
    return _extract_from_top_level_ref(slip_case_id, recipient, str(raw_ref))


# ─── Adapter ───────────────────────────────────────────────────────────────


class SlipCasesAdapter:
    """Bridge from ``slip_cases`` JSONB rows to :class:`SOCHistory`.

    The adapter is **read-only** — it never writes to the database.
    Construction takes an optional session for a future Phase-3c live
    path; Phase 3b uses :meth:`populate` with caller-supplied rows in
    tests, and a thin DB query in production.
    """

    def __init__(
        self,
        db_session: Any = None,
        *,
        quality_threshold: str = QUALITY_PARTIAL,
    ) -> None:
        if quality_threshold not in QUALITY_ORDER:
            raise ValueError(
                f"unknown quality_threshold {quality_threshold!r}; "
                f"expected one of {QUALITY_ORDER}"
            )
        self._db_session = db_session
        self._threshold = quality_threshold

    @property
    def quality_threshold(self) -> str:
        return self._threshold

    def populate(
        self,
        history: SOCHistory,
        *,
        rows: Optional[Iterable[dict]] = None,
    ) -> SlipCasesSyncReport:
        """Read slip_cases rows, extract partial keys, push admitted
        ones into ``history``, and return a summary report.

        ``rows`` lets callers (especially tests) supply an in-memory
        iterable of slip_case dicts. When ``rows`` is None the adapter
        falls back to a database query against the bound session,
        which is the production code path. Phase 3b ships only the
        in-memory path; the DB-query method lives behind
        :meth:`_fetch_from_db` and remains a NotImplementedError until
        Phase 3c attaches the real query.
        """
        if rows is None:
            rows = self._fetch_from_db()
        rows = list(rows)

        report = SlipCasesSyncReport(total_slip_cases=len(rows))
        report.quality_breakdown = {q: 0 for q in QUALITY_ORDER}

        for row in rows:
            keys, skip_reasons = extract_keys_from_slip_case(row)
            for reason in skip_reasons:
                report.skipped.append({
                    "slip_case_id": str(row.get("id") or "?"),
                    "reason": reason,
                })
            for key in keys:
                report.extracted_keys += 1
                report.quality_breakdown[key.quality] = (
                    report.quality_breakdown.get(key.quality, 0) + 1
                )
                if not _quality_meets_threshold(key.quality, self._threshold):
                    report.skipped.append({
                        "slip_case_id": key.slip_case_id,
                        "reason": (
                            f"quality {key.quality!r} below threshold "
                            f"{self._threshold!r}"
                        ),
                    })
                    continue
                added = history.add_partial(
                    recipient=key.recipient,
                    ref_body=key.ref_body,
                    revision=key.revision,
                    quality=key.quality,
                )
                if added:
                    report.admitted_to_history += 1

        return report

    def _fetch_from_db(self) -> list[dict]:
        """Phase 3c — real DB query, read-only and graceful.

        Returns the cedant=KB SOC slip_cases rows from the bound
        session. Errors (no session, connection failure, query error)
        degrade to an empty list with a warning logged; the caller
        gets to continue without a partial tier rather than crashing
        the whole soc_stream flow.

        Cached per-instance so a single SSE stream that re-queries
        history doesn't hit the DB twice.
        """
        if hasattr(self, "_cache") and self._cache is not None:
            return self._cache

        if self._db_session is None:
            self._cache = []
            self._fetch_error = "no db_session bound"
            return self._cache

        try:
            from sqlalchemy import text
            stmt = text(
                """
                SELECT id, doc_type, status, extracted, input_files
                FROM slip_cases
                WHERE is_deleted = false
                  AND extracted->>'cedant' = 'KB'
                  AND doc_type = 'SOC'
                LIMIT 1000
                """
            )
            result = self._db_session.execute(stmt)
            mappings = result.mappings().all()
            self._cache = [
                {
                    "id": str(m["id"]),
                    "doc_type": m["doc_type"],
                    "status": m["status"],
                    "extracted": m["extracted"],
                    "input_files": m["input_files"],
                }
                for m in mappings
            ]
            self._fetch_error = None
            return self._cache
        except Exception as e:
            # Graceful degrade: never let a slip_cases failure break
            # the wider soc_stream flow. The audit trail keeps the
            # error so the operator can investigate offline.
            import logging
            logging.getLogger(__name__).warning(
                "SlipCasesAdapter._fetch_from_db failed; degrading to empty: %s",
                e,
            )
            self._cache = []
            self._fetch_error = str(e)
            return self._cache

    @property
    def fetch_error(self) -> Optional[str]:
        """Last DB-fetch error, if any. ``None`` when the most recent
        fetch succeeded or hasn't been attempted yet."""
        return getattr(self, "_fetch_error", None)


# ─── Reconciliation (used by the audit script) ─────────────────────────────


def reconcile(slip_rows: list[dict], bordereau_history: SOCHistory) -> dict:
    """Compare slip_cases-derived partial keys against bordereau
    full keys and bucket the result for audit reporting.

    Returns a dict with three ref-level buckets — ``both``,
    ``bordereau_only``, ``slip_only`` — plus per-row extraction details
    and the underlying :class:`SlipCasesSyncReport` quality breakdown.

    The function is read-only and side-effect free; it builds a
    second :class:`SOCHistory` for the slip_cases tier rather than
    mutating ``bordereau_history``.
    """
    slip_partial_history = SOCHistory()
    adapter = SlipCasesAdapter(quality_threshold=QUALITY_INFERRED)
    sync_report = adapter.populate(slip_partial_history, rows=slip_rows)

    per_row_keys: list[dict] = []
    for row in slip_rows:
        keys, reasons = extract_keys_from_slip_case(row)
        per_row_keys.append({
            "slip_case_id": str(row.get("id") or "?"),
            "extracted": [
                {
                    "recipient": k.recipient,
                    "ref_body": k.ref_body,
                    "revision": k.revision,
                    "quality": k.quality,
                }
                for k in keys
            ],
            "skipped_reasons": reasons,
        })

    bordereau_refs = set(bordereau_history._bordereau_ref_set)
    slip_refs = set(slip_partial_history._partial_ref_set)

    both = bordereau_refs & slip_refs
    bordereau_only = bordereau_refs - slip_refs
    slip_only = slip_refs - bordereau_refs

    return {
        "slip_cases_total": len(slip_rows),
        "sync_report": {
            "extracted_keys": sync_report.extracted_keys,
            "admitted": sync_report.admitted_to_history,
            "quality_breakdown": dict(sync_report.quality_breakdown),
            "skipped": sync_report.skipped,
        },
        "bordereau_keys_total": len(bordereau_history),
        "bordereau_refs_total": len(bordereau_refs),
        "slip_partial_keys_total": slip_partial_history.partial_count(),
        "slip_refs_total": len(slip_refs),
        "ref_level_both": sorted(both),
        "ref_level_bordereau_only": sorted(bordereau_only),
        "ref_level_slip_only": sorted(slip_only),
        "per_row_keys": per_row_keys,
    }
