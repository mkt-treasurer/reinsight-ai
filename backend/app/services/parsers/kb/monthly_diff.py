"""Core monthly-diff engine.

Inputs:
- ``previous`` and ``current`` :class:`KBMonthlySnapshot` instances
- a populated :class:`SOCHistory` (containing at minimum ``current``'s
  SOC files; typically also previous months')

Output:
- a list of :class:`ClaimTransition`, one per base key seen in either
  month or both

Matching key is the 5-tuple
``(recipient, ref_no.key, casualty, item_serial, cession_serial)`` —
revision is excluded so REVISION_BUMP / REVISION_GAP / REVISION_REGRESSION
can be detected as continuations rather than disappear+appear pairs.

When a row appears or disappears unexpectedly, a Pass-2 audit checks
whether a near-match exists at 4-tuple level (dropping casualty).
The transition itself is not changed by the audit; the result lands
in ``ClaimTransition.notes`` with one of three sentinel prefixes:

- ``casualty_drift_suspected`` — exactly one near-match candidate
- ``casualty_ambiguous_with_siblings`` — multiple near-match candidates
- (nothing) — zero near-matches; transition stays unmarked
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from ..kb_bordereau import KBBordereauResult, KBClaimRow
from .errors import KBSnapshotError
from .monthly_snapshot import KBMonthlySnapshot
from .soc_history import SOCHistory, row_base_key


# ─── Output types ──────────────────────────────────────────────────────────


class TransitionType(Enum):
    """Lifecycle transition observed for a single claim base key."""

    NEW = "new"
    """Base key absent from previous month, present in current month,
    no SOC history under that base key. Genuinely new claim."""

    REOPENED = "reopened"
    """Base key absent from previous month, present in current month,
    SOC history shows the claim was previously settled. Reopened or
    re-filed under the same identity."""

    UNCHANGED = "unchanged"
    """Base key present in both months with identical revision."""

    REVISION_BUMP = "revision_bump"
    """Base key present in both months; current revision = previous + 1.
    Normal OS estimate update."""

    REVISION_GAP = "revision_gap"
    """Base key present in both months; current revision > previous + 1.
    Revisions skipped — KB internal cancellation, reset, or data gap."""

    REVISION_REGRESSION = "revision_regression"
    """Base key present in both months; current revision < previous.
    Anomaly: revision number went backwards."""

    SETTLED = "settled"
    """Base key present in previous PLA, absent from current PLA,
    SOC history records the claim. 지급 종결."""

    DISMISSED = "dismissed"
    """Base key present in previous PLA, absent from current PLA, no
    SOC history record. 면책 종결."""


# Sentinel substrings used in ``ClaimTransition.notes``. Keeping them
# as constants makes downstream filtering (audit script, future Phase-3
# reviewer queue) precise.
ANOMALY_REGRESSION = "anomaly:regression"
DRIFT_UNIQUE = "casualty_drift_suspected"
DRIFT_AMBIGUOUS = "casualty_ambiguous_with_siblings"


@dataclass(frozen=True)
class ClaimTransition:
    """One transition observation between two monthly snapshots.

    ``base_key`` is the 5-tuple matching key; ``previous`` and
    ``current`` are the source rows (one may be ``None`` for SETTLED /
    DISMISSED / NEW / REOPENED). ``soc_seen`` mirrors what the
    classifier looked up; surfacing it on the transition lets audit
    code present "settled at revs {1, 3}" without re-querying.
    """

    base_key: tuple
    transition: TransitionType
    previous: Optional[KBClaimRow]
    current: Optional[KBClaimRow]
    soc_seen: bool
    notes: tuple[str, ...] = field(default_factory=tuple)


# ─── Indexing ──────────────────────────────────────────────────────────────


_BaseKey = tuple


def _index_by_base_key(
    result: Optional[KBBordereauResult],
) -> dict[_BaseKey, KBClaimRow]:
    """Return a base-key → row mapping for one PLA result.

    Raises :class:`KBSnapshotError` if the input contains two rows
    with the same base key — Phase-1 fixtures show this never happens
    (per ``TestSiblingCasualties::test_natural_key_uniqueness_across_full_fixtures``)
    but we treat the invariant as load-bearing rather than informational.
    """
    if result is None:
        return {}
    out: dict[_BaseKey, KBClaimRow] = {}
    for row in result.rows:
        base = row_base_key(row)
        if base is None:
            # ref_no parse failure — already a row-level warning on
            # the result, skip from diff.
            continue
        if base in out:
            raise KBSnapshotError(
                f"duplicate base key in {result.file_name!r}: {base!r} "
                f"(rows {out[base].row_index} and {row.row_index})"
            )
        out[base] = row
    return out


# ─── Continuing-claim classification ───────────────────────────────────────


def _classify_continuing(
    base_key: _BaseKey,
    previous: KBClaimRow,
    current: KBClaimRow,
) -> ClaimTransition:
    """Decide which CONTINUING-type transition fits when both months
    contain the same base key."""
    p_rev = previous.revision
    c_rev = current.revision

    if p_rev is None or c_rev is None:
        # We can't reason about gaps when one side has no revision;
        # call it UNCHANGED with a note so audit can spot it.
        notes = (
            f"revision asymmetric: previous={p_rev}, current={c_rev}",
        ) if p_rev != c_rev else ()
        return ClaimTransition(
            base_key=base_key,
            transition=TransitionType.UNCHANGED,
            previous=previous,
            current=current,
            soc_seen=False,
            notes=notes,
        )

    if c_rev == p_rev:
        return ClaimTransition(
            base_key=base_key,
            transition=TransitionType.UNCHANGED,
            previous=previous,
            current=current,
            soc_seen=False,
        )
    if c_rev == p_rev + 1:
        return ClaimTransition(
            base_key=base_key,
            transition=TransitionType.REVISION_BUMP,
            previous=previous,
            current=current,
            soc_seen=False,
        )
    if c_rev > p_rev + 1:
        return ClaimTransition(
            base_key=base_key,
            transition=TransitionType.REVISION_GAP,
            previous=previous,
            current=current,
            soc_seen=False,
            notes=(
                f"revision gap: {p_rev} → {c_rev} "
                f"(skipped {c_rev - p_rev - 1})",
            ),
        )
    # c_rev < p_rev — anomaly. Mark explicitly so audit can route to
    # human review.
    return ClaimTransition(
        base_key=base_key,
        transition=TransitionType.REVISION_REGRESSION,
        previous=previous,
        current=current,
        soc_seen=False,
        notes=(
            ANOMALY_REGRESSION,
            f"revision regressed: {p_rev} → {c_rev}",
        ),
    )


# ─── Pass-2 casualty drift audit ───────────────────────────────────────────


def _audit_casualty_drift(
    base_key: _BaseKey,
    other_index: dict[_BaseKey, KBClaimRow],
    *,
    direction: str,
) -> tuple[str, ...]:
    """Look for near-matches at 4-tuple level (drop casualty).

    ``direction`` is ``"disappeared"`` when ``base_key`` was in the
    previous snapshot but not the current one (DISMISSED / SETTLED
    candidate), or ``"appeared"`` when it's the opposite (NEW /
    REOPENED candidate). The text wording adapts to the direction so
    operators reading the audit can tell which side is suspected of
    drifting.

    Returns a tuple of zero or one note string:
    - 0 strings when no near-match candidate exists in ``other_index``
    - 1 string with prefix ``casualty_drift_suspected:`` for unique
    - 1 string with prefix ``casualty_ambiguous_with_siblings:`` for
      multiple candidates
    """
    recipient, ref_key, casualty, item, cession = base_key
    candidates = [
        k for k in other_index
        if k[0] == recipient
        and k[1] == ref_key
        and k[3] == item
        and k[4] == cession
        and k[2] != casualty  # different casualty = drift candidate
    ]

    if not candidates:
        return ()

    if len(candidates) == 1:
        other_casualty = candidates[0][2]
        if direction == "disappeared":
            msg = (
                f"{DRIFT_UNIQUE}: previous casualty {casualty!r} may have "
                f"become {other_casualty!r} in current month "
                f"(ref={ref_key!r}, item={item}, cession={cession})"
            )
        else:
            msg = (
                f"{DRIFT_UNIQUE}: current casualty {casualty!r} may have "
                f"come from {other_casualty!r} in previous month "
                f"(ref={ref_key!r}, item={item}, cession={cession})"
            )
        return (msg,)

    sibling_casualties = sorted(k[2] or "" for k in candidates)
    msg = (
        f"{DRIFT_AMBIGUOUS}: {casualty!r} could match any of "
        f"{sibling_casualties!r} via 4-tuple sibling collapse "
        f"(ref={ref_key!r}, item={item}, cession={cession})"
    )
    return (msg,)


# ─── Single-stream diff ────────────────────────────────────────────────────


def _diff_pla_stream(
    previous: Optional[KBBordereauResult],
    current: Optional[KBBordereauResult],
    soc_history: SOCHistory,
) -> list[ClaimTransition]:
    """Diff one (recipient × PLA) stream.

    ``None`` for either side is allowed: a brand-new month with no
    previous data, or a recipient that stopped reporting, both reduce
    to "everything in the other side is NEW or DISMISSED".
    """
    prev_rows = _index_by_base_key(previous)
    curr_rows = _index_by_base_key(current)

    transitions: list[ClaimTransition] = []

    # Continuing claims — classify by revision delta.
    for base in prev_rows.keys() & curr_rows.keys():
        transitions.append(_classify_continuing(
            base, prev_rows[base], curr_rows[base]
        ))

    # Disappeared from PLA — SETTLED if SOC history has it,
    # DISMISSED otherwise.
    for base in prev_rows.keys() - curr_rows.keys():
        seen = soc_history.has_seen(base)
        notes = _audit_casualty_drift(
            base, curr_rows, direction="disappeared",
        )
        transitions.append(ClaimTransition(
            base_key=base,
            transition=(
                TransitionType.SETTLED if seen else TransitionType.DISMISSED
            ),
            previous=prev_rows[base],
            current=None,
            soc_seen=seen,
            notes=notes,
        ))

    # Newly appeared in PLA — REOPENED if SOC history shows prior
    # settlement under this identity, NEW otherwise.
    for base in curr_rows.keys() - prev_rows.keys():
        seen = soc_history.has_seen(base)
        notes = _audit_casualty_drift(
            base, prev_rows, direction="appeared",
        )
        transitions.append(ClaimTransition(
            base_key=base,
            transition=(
                TransitionType.REOPENED if seen else TransitionType.NEW
            ),
            previous=None,
            current=curr_rows[base],
            soc_seen=seen,
            notes=notes,
        ))

    return transitions


# ─── Public entry point ────────────────────────────────────────────────────


def diff_monthly(
    previous: KBMonthlySnapshot,
    current: KBMonthlySnapshot,
    soc_history: SOCHistory,
) -> list[ClaimTransition]:
    """Compute the full set of claim transitions between two months.

    Diffs each recipient stream independently — INS rows never match
    DAEWOO rows because the recipient is part of the base key. The
    SOC history is shared across recipients (one claim's SOC counts as
    settlement evidence regardless of which recipient stream the diff
    is examining).
    """
    transitions: list[ClaimTransition] = []
    transitions.extend(_diff_pla_stream(
        previous.pla_ins, current.pla_ins, soc_history,
    ))
    transitions.extend(_diff_pla_stream(
        previous.pla_daewoo, current.pla_daewoo, soc_history,
    ))
    return transitions
