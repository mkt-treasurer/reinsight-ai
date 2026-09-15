"""KB reference-number parsing.

Turns raw KB ``접수번호`` strings into a uniform :class:`ParsedRefNo`
so downstream code does not need to know the cedant-specific layout.

The canonical KB shape is ``YYYY-MMDDNNNNNN [RRR]`` where the optional
``RRR`` is a zero-padded 3-digit revision (`추산차수` for PLA,
`결정차수` for SOC). Several legacy variants observed in production
are accepted and surfaced through ``format_variant`` and ``notes``.

Sentinel values such as ``various`` are recognised and returned with
``is_sentinel=True`` so callers can keep the row but skip ref-no-based
joining. Truly unparseable input raises :class:`RefNoParseError`.

HW (Hanwha) ref-no parsing is **not** part of this module. A Phase-2
draft lives in ``parsers._unverified.hw_ref_no_draft`` and must not
be imported from production code until verified against real
fixtures.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from .errors import RefNoParseError


# ─── Data model ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ParsedRefNo:
    """A reference number decomposed into the parts we can recover.

    Three string fields, each with a distinct purpose:

    - ``raw``: the input verbatim. Use for logging / error context.
    - ``normalized`` (display): DB-compatible form with whitespace
      separator between body and revision (e.g. ``2026-0204009404 001``).
      Matches what is already stored in ``claims.ref_no`` for backward
      compatibility on existing rows. Use for human-facing surfaces.
    - ``key``: whitespace-free canonical key suitable for new code paths
      that need a clean identifier — URL slugs, JSON path components,
      dedup hash inputs (e.g. ``2026-0204009404-001``). Caveat: legacy
      ``외`` suffix is preserved verbatim, so the key may contain
      non-ASCII characters when the source ref carried it.

    Numeric date parts are filled when the format encodes them; legacy
    rows whose 10-digit core decodes to ``MM=00`` leave both ``month``
    and ``day`` as ``None`` (``format_variant="kb_legacy_opaque"``).
    """

    raw: str
    cedant: str
    normalized: str
    key: str
    format_variant: str
    year: Optional[int] = None
    month: Optional[int] = None
    day: Optional[int] = None
    serial: Optional[str] = None
    revision: Optional[int] = None
    line_code: Optional[str] = None
    is_sentinel: bool = False
    notes: tuple[str, ...] = field(default_factory=tuple)

    @property
    def body(self) -> str:
        """Reference number without the revision suffix.

        Two settlement rows that share the same ``body`` are
        successive billings of the same underlying incident. The
        revision (``001``, ``002``, ``003`` …) is the per-incident
        sequence number. Customers identify "동일 사고" by
        ``(body, dol)``; surfacing ``body`` as a first-class field
        lets bordereau output expose incident identity even when the
        Insured name is masked at the source.
        """
        # Strip the trailing 외 aggregation marker first so the
        # revision-suffix match below works regardless of its presence.
        stem = self.key[:-1] if self.key.endswith("외") else self.key
        if self.revision is None:
            return stem
        suffix = f"-{self.revision:03d}"
        if stem.endswith(suffix):
            return stem[: -len(suffix)]
        # Fallback for non-canonical revision widths (already noted on
        # ``notes`` during parse). Strip the trailing "-<digits>" group.
        m = re.search(r"-\d+$", stem)
        if m:
            return stem[: m.start()]
        return stem


# ─── Shared helpers ────────────────────────────────────────────────────────


def _clean(raw: str) -> str:
    """Collapse internal whitespace runs and trim outer whitespace.

    Matches what we see in real KB data, where double-spaces or
    embedded tabs occasionally sneak in from copy-paste.
    """
    if raw is None:
        raise RefNoParseError("ref_no is None")
    s = str(raw).strip()
    if not s:
        raise RefNoParseError("ref_no is empty")
    return re.sub(r"\s+", " ", s)


# Sentinel labels we observed in production data — KB doesn't use these
# as actual ref numbers, but they appear in the column.
_KB_SENTINELS = frozenset({"various"})


# ─── KB parser ─────────────────────────────────────────────────────────────


# Canonical KB shape: 4-digit year, optional hyphen, 10-digit core
# (MM+DD+6-digit serial), optional space + 3-digit revision, optional
# 외 suffix meaning "and others" (multi-claim aggregation).
_KB_CORE = re.compile(
    r"""^
    (?P<year>\d{4})
    -?
    (?P<core>\d{10})
    (?:[ \-](?P<rev>\d{1,4}))?
    (?P<ext>외)?
    $""",
    re.VERBOSE,
)


def _build_kb_forms(
    year: int,
    core: str,
    revision: Optional[int],
    ext: Optional[str],
) -> tuple[str, str]:
    """Return ``(normalized, key)`` for a KB ref.

    ``normalized`` keeps the historical space separator between body
    and revision; ``key`` substitutes a hyphen so the value is safe to
    drop into URL paths and dedup hash inputs without escaping.
    """
    body = f"{year:04d}-{core}"
    if revision is not None:
        normalized = f"{body} {revision:03d}"
        key = f"{body}-{revision:03d}"
    else:
        normalized = body
        key = body
    if ext:
        # ``외`` is non-ASCII but carries claim-aggregation semantics; we
        # preserve it on both forms rather than silently dropping it.
        normalized = normalized + ext
        key = key + ext
    return normalized, key


def parse_kb_ref_no(raw: str, revision: Optional[int] = None) -> ParsedRefNo:
    """Parse a KB reference number.

    Two call shapes:
    - From the Excel source: ``parse_kb_ref_no("20260204009404", revision=1)``.
      ``raw`` is the 14-digit ``접수번호 (KB Ref)`` cell value and
      ``revision`` is the ``추산차수`` / ``결정차수`` integer column.
    - From a DB-stored ref: ``parse_kb_ref_no("2026-0204009404 001")``.
      Revision (and optional hyphen) live inside ``raw`` itself.
    """
    s = _clean(raw)

    if s in _KB_SENTINELS:
        return ParsedRefNo(
            raw=raw,
            cedant="KB",
            normalized=s,
            key=s,
            format_variant="sentinel",
            is_sentinel=True,
        )

    m = _KB_CORE.match(s)
    if not m:
        raise RefNoParseError(f"KB ref_no does not match canonical pattern: {raw!r}")

    notes: list[str] = []
    year = int(m.group("year"))
    core = m.group("core")
    embedded_rev = m.group("rev")
    ext = m.group("ext")

    if embedded_rev is not None and revision is not None:
        # Both parameter and embedded revision provided. Trust the explicit
        # parameter (it came from the source column) and warn on mismatch.
        try:
            embedded_int = int(embedded_rev)
        except ValueError:
            embedded_int = None
        if embedded_int is not None and embedded_int != revision:
            notes.append(
                f"revision conflict: embedded={embedded_int} parameter={revision}"
            )
    elif embedded_rev is not None:
        try:
            revision = int(embedded_rev)
        except ValueError:
            notes.append(f"non-integer embedded revision: {embedded_rev!r}")
        else:
            if len(embedded_rev) != 3:
                # Most KB revs are 3-digit zero-padded; track the deviation
                # so we can surface it without dropping the row.
                notes.append(f"non-canonical revision width: {embedded_rev!r}")

    if not (1900 <= year <= 2100):
        raise RefNoParseError(f"KB ref_no year out of range: {year}")

    month = int(core[0:2])
    day = int(core[2:4])
    serial = core[4:]

    if month == 0:
        notes.append("month=00 (legacy-format opaque core)")
        month_out: Optional[int] = None
    elif not 1 <= month <= 12:
        notes.append(f"invalid month {month:02d}")
        month_out = None
    else:
        month_out = month

    if month_out is not None and not 1 <= day <= 31:
        notes.append(f"invalid day {day:02d}")
        day_out: Optional[int] = None
    elif month_out is None:
        day_out = None
    else:
        day_out = day

    if ext:
        notes.append("multi-claim aggregation suffix '외' present")

    normalized, key = _build_kb_forms(year, core, revision, ext)
    variant = "kb_modern" if month_out is not None else "kb_legacy_opaque"

    return ParsedRefNo(
        raw=raw,
        cedant="KB",
        normalized=normalized,
        key=key,
        format_variant=variant,
        year=year,
        month=month_out,
        day=day_out,
        serial=serial,
        revision=revision,
        notes=tuple(notes),
    )
