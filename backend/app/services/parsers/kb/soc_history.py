"""SOC publication history accumulator.

The diff engine asks one question of this object: *"has this claim
been settled at any revision?"* Per the Phase-1 step-1 decision the
storage and query keys differ:

- **Stored**: full 6-tuple keys ``(recipient, ref_body, casualty,
  item_serial, cession_serial, revision)``, preserving the revision
  dimension so we don't lose information when a claim settles across
  multiple partial-payment events.
- **Queried**: 5-tuple base keys (``ref_body`` instead of revision-
  aware ``ref_no.key``), matching the diff engine's matching key. The
  domain rule ("SOC에만 반영되고 이후 자료에서 제외된 경우는 지급
  종결") is defined at the **claim** level, not the revision level —
  once any revision of a claim has been issued through SOC, the claim
  counts as having been settled.

Note: this module does **not** reuse Phase-1's ``natural_key()``
because that helper encodes revision into ``ref_no.key`` *and* as a
trailing field, so dropping the trailing field still leaves a
revision-specific identifier behind. Phase 2 keys use ``ref_body``
(``ref_no.key`` with the trailing ``-RRR`` suffix stripped) so the
5-tuple really is revision-agnostic.

Phase 2 is DB-free: input is :class:`KBBordereauResult` instances
returned by :func:`parse_kb_bordereau`. Phase 3 will add a sync
hook that ingests ``slip_cases`` JSONB rows produced by the live
SOC-generation pipeline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable, Optional

from ..kb_bordereau import KBBordereauResult, KBClaimRow


# 6-tuple stored as-is; 5-tuple = 6-tuple minus the trailing revision.
_FullKey = tuple
_BaseKey = tuple


# Strip the ``-RRR`` (3-digit revision) suffix from a KB ref_no.key.
# Preserves a trailing ``외`` (multi-claim aggregation marker) since
# that's part of the claim body, not the revision.
_REV_SUFFIX_RE = re.compile(r"-(\d{3})(외)?$")


def _ref_body(ref_no_key: str) -> str:
    """Return the revision-less KB claim identifier.

    Examples:
    - ``2026-0204009404-001``  →  ``2026-0204009404``
    - ``2026-0204009404-001외`` → ``2026-0204009404외``
    - ``2026-0204009404``       →  ``2026-0204009404`` (already revless)
    - ``various``               →  ``various`` (sentinel stays)
    """
    m = _REV_SUFFIX_RE.search(ref_no_key)
    if m:
        ext = m.group(2) or ""
        return ref_no_key[: m.start()] + ext
    return ref_no_key


def row_base_key(row: KBClaimRow) -> Optional[_BaseKey]:
    """5-tuple revision-agnostic key for a row, or ``None`` if the
    row's ref_no failed to parse."""
    if row.ref_no is None:
        return None
    return (
        row.recipient,
        _ref_body(row.ref_no.key),
        row.casualty,
        row.item_serial,
        row.cession_serial,
    )


def row_full_key(row: KBClaimRow) -> Optional[_FullKey]:
    """6-tuple revision-aware key for storage. Equals the 5-tuple
    base key plus the trailing revision."""
    base = row_base_key(row)
    if base is None:
        return None
    return (*base, row.revision)


def _to_base_key(full: _FullKey) -> _BaseKey:
    """Drop the trailing revision component from a 6-tuple."""
    if len(full) != 6:
        raise ValueError(
            f"expected 6-tuple key, got length {len(full)}"
        )
    return full[:5]


# Quality grades for slip_cases (Phase 3b). The order matters —
# higher index = lower quality. Used to compare against an admission
# threshold in :class:`SlipCasesAdapter`.
QUALITY_EXACT = "exact"
QUALITY_PARTIAL = "partial"
QUALITY_INFERRED = "inferred"
QUALITY_ORDER = (QUALITY_EXACT, QUALITY_PARTIAL, QUALITY_INFERRED)


# Phase 3b partial keys are 3-tuples — slip_cases JSONB never carries
# casualty / item_serial / cession_serial, so the best we can do is
# (recipient, ref_body, revision). Stored in a separate index so
# Phase-2 strict matching stays untouched.
_PartialKey = tuple  # (recipient: str, ref_body: str, revision: Optional[int])


@dataclass
class SOCHistory:
    """Accumulator that answers ``has this claim ever been settled?``

    Two storage tiers, queried at different precision levels:

    - **Bordereau tier** (Phase 2). Full 6-tuple natural keys ingested
      from :func:`parse_kb_bordereau` results via :meth:`add`. Queried
      by :meth:`has_seen` at the 5-tuple base-key level. This is the
      authoritative source.

    - **Partial tier** (Phase 3b). 3-tuple ``(recipient, ref_body,
      revision)`` keys ingested from ``slip_cases.extracted`` JSONB
      via :meth:`add_partial`. The JSONB doesn't carry casualty /
      item_serial / cession_serial, so partial keys cannot satisfy the
      strict 5-tuple :meth:`has_seen` check; they're queried via
      :meth:`has_seen_at_ref_level` instead.

    The two tiers union at ref-level only — :meth:`has_seen_at_ref_level`
    returns True if either tier has any record under
    ``(recipient, ref_body)``. The diff engine continues to use
    :meth:`has_seen` (strict) so partial entries can't accidentally
    influence Phase-2 SETTLED / DISMISSED classification.
    """

    # Bordereau tier
    _full_keys: set[_FullKey] = field(default_factory=set)
    _by_base: dict[_BaseKey, set[Optional[int]]] = field(default_factory=dict)
    _bordereau_ref_set: set[tuple[str, str]] = field(default_factory=set)

    # Partial tier (slip_cases-sourced)
    _partial_keys: set[_PartialKey] = field(default_factory=set)
    _partial_quality: dict[_PartialKey, str] = field(default_factory=dict)
    _partial_ref_set: set[tuple[str, str]] = field(default_factory=set)

    # ─── Bordereau ingestion (Phase 2) ─────────────────────────────────────

    def add(self, soc_result: KBBordereauResult) -> int:
        """Ingest every parseable row of one SOC result.

        Returns the number of new (previously unseen) full keys added.
        Rows whose ref_no failed to parse are silently skipped; those
        are already surfaced as parse warnings on the source result.
        """
        if soc_result.sheet_kind != "SOC":
            raise ValueError(
                f"SOCHistory.add expected sheet_kind=SOC, got "
                f"{soc_result.sheet_kind!r} (file={soc_result.file_name!r})"
            )
        added = 0
        for row in soc_result.rows:
            full = row_full_key(row)
            if full is None:
                continue
            if full not in self._full_keys:
                self._full_keys.add(full)
                added += 1
            base = _to_base_key(full)
            self._by_base.setdefault(base, set()).add(full[5])
            self._bordereau_ref_set.add((full[0], full[1]))
        return added

    def add_many(self, results: Iterable[KBBordereauResult]) -> int:
        """Convenience: ingest a batch and return the total new-key
        count. Useful for batch-loading several months of SOCs."""
        return sum(self.add(r) for r in results)

    # ─── Partial ingestion (Phase 3b) ──────────────────────────────────────

    def add_partial(
        self,
        recipient: str,
        ref_body: str,
        revision: Optional[int],
        *,
        quality: str,
    ) -> bool:
        """Record a slip_cases-derived partial key.

        Returns True if the key was new, False if a duplicate. Idempotent
        on repeated calls with identical input.
        """
        if quality not in QUALITY_ORDER:
            raise ValueError(
                f"unknown quality grade {quality!r}; "
                f"expected one of {QUALITY_ORDER}"
            )
        if not recipient or not ref_body:
            raise ValueError(
                "add_partial requires both recipient and ref_body"
            )
        key = (recipient, ref_body, revision)
        if key in self._partial_keys:
            return False
        self._partial_keys.add(key)
        self._partial_quality[key] = quality
        self._partial_ref_set.add((recipient, ref_body))
        return True

    # ─── Queries ───────────────────────────────────────────────────────────

    def has_seen(self, base_key: _BaseKey) -> bool:
        """Return ``True`` if any revision under this base key has been
        recorded **in the bordereau tier**.

        Phase-2 strict matching uses this; partial entries do not
        contribute, by design.
        """
        if len(base_key) != 5:
            raise ValueError(
                f"expected 5-tuple base key, got length {len(base_key)}"
            )
        return base_key in self._by_base

    def has_seen_at_ref_level(self, recipient: str, ref_body: str) -> bool:
        """Return ``True`` if either tier has a record under
        ``(recipient, ref_body)``. Coarser than :meth:`has_seen` —
        ignores casualty / item / cession.

        Use for audit-style "did we ever pay anything against this
        ref?" questions, not for Phase-2 transition classification.
        """
        ref_pair = (recipient, ref_body)
        return (
            ref_pair in self._bordereau_ref_set
            or ref_pair in self._partial_ref_set
        )

    def revisions_seen(self, base_key: _BaseKey) -> frozenset[Optional[int]]:
        """Return the set of revisions seen under this base key.

        Bordereau tier only — partial entries don't carry the full
        5-tuple needed to disambiguate sibling casualty rows.
        """
        return frozenset(self._by_base.get(base_key, set()))

    def partial_quality(self, recipient: str, ref_body: str, revision: Optional[int]) -> Optional[str]:
        """Return the quality grade recorded for one partial key, or
        ``None`` if no partial entry exists for that exact tuple."""
        return self._partial_quality.get((recipient, ref_body, revision))

    # ─── Sizes ─────────────────────────────────────────────────────────────

    def __len__(self) -> int:
        """Distinct bordereau-tier full keys. Backward compatible with
        Phase-2 callers that only care about the authoritative source."""
        return len(self._full_keys)

    def partial_count(self) -> int:
        """Distinct partial-tier keys."""
        return len(self._partial_keys)

    def __contains__(self, base_key: _BaseKey) -> bool:
        return self.has_seen(base_key)
