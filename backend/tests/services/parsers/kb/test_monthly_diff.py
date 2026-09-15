"""Unit tests for :func:`diff_monthly` and the helpers underneath.

Each test isolates one decision point of the engine. Scenario-style
tests that drive the engine end-to-end with real xlsx fixtures live
in :mod:`test_monthly_diff_scenarios`.
"""

from __future__ import annotations

from collections import Counter

import pytest

from app.services.parsers.kb import (
    ClaimTransition,
    KBMonthlySnapshot,
    KBSnapshotError,
    SOCHistory,
    TransitionType,
    diff_monthly,
)
from app.services.parsers.kb.monthly_diff import (
    ANOMALY_REGRESSION,
    DRIFT_AMBIGUOUS,
    DRIFT_UNIQUE,
    _diff_pla_stream,
)
from app.services.parsers.kb_bordereau import (
    SHEET_KIND_PLA,
    SHEET_KIND_SOC,
    KBClaimRow,
)

from ._builders import (
    DAEWOO_RECIPIENT,
    INS_RECIPIENT,
    make_result,
    make_row,
)


# ─── Fixture helpers ───────────────────────────────────────────────────────


def _empty_history() -> SOCHistory:
    return SOCHistory()


def _diff(prev_rows, curr_rows, soc=None) -> list[ClaimTransition]:
    """Run the per-stream diff with two row lists. Convenience for the
    bulk of unit tests that don't need the full snapshot envelope."""
    soc = soc or _empty_history()
    return _diff_pla_stream(
        make_result(prev_rows, sheet_kind=SHEET_KIND_PLA) if prev_rows else None,
        make_result(curr_rows, sheet_kind=SHEET_KIND_PLA) if curr_rows else None,
        soc,
    )


def _by_type(transitions) -> dict[TransitionType, int]:
    return dict(Counter(t.transition for t in transitions))


# ─── Continuing-claim transitions ──────────────────────────────────────────


class TestContinuingClaims:
    def test_unchanged_same_revision(self):
        prev = [make_row(ref="20260101000001", revision=2)]
        curr = [make_row(ref="20260101000001", revision=2)]
        ts = _diff(prev, curr)
        assert len(ts) == 1
        assert ts[0].transition == TransitionType.UNCHANGED
        assert ts[0].previous is not None and ts[0].current is not None
        assert ts[0].notes == ()

    def test_revision_bump_n_to_n_plus_1(self):
        prev = [make_row(ref="20260101000001", revision=0)]
        curr = [make_row(ref="20260101000001", revision=1)]
        ts = _diff(prev, curr)
        assert ts[0].transition == TransitionType.REVISION_BUMP

    def test_revision_gap_emits_skipped_count(self):
        prev = [make_row(ref="20260101000001", revision=0)]
        curr = [make_row(ref="20260101000001", revision=3)]
        ts = _diff(prev, curr)
        assert ts[0].transition == TransitionType.REVISION_GAP
        # Skip count surfaced in notes for audit visibility.
        assert any("skipped 2" in n for n in ts[0].notes)
        assert any("0 → 3" in n for n in ts[0].notes)

    def test_revision_regression_marked_as_anomaly(self):
        """Revision going backwards is an anomaly per Phase-2 policy.
        Notes must contain the literal ``anomaly:regression`` so audit
        can route the transition to a separate review section."""
        prev = [make_row(ref="20260101000001", revision=2)]
        curr = [make_row(ref="20260101000001", revision=1)]
        ts = _diff(prev, curr)
        assert ts[0].transition == TransitionType.REVISION_REGRESSION
        assert ANOMALY_REGRESSION in ts[0].notes

    def test_revision_none_treated_as_unchanged_with_note(self):
        # When parser couldn't pin a revision, fall back to UNCHANGED.
        prev = [make_row(ref="20260101000001", revision=None)]
        curr = [make_row(ref="20260101000001", revision=None)]
        ts = _diff(prev, curr)
        assert ts[0].transition == TransitionType.UNCHANGED


# ─── Disappeared rows: SETTLED / DISMISSED ─────────────────────────────────


class TestDisappeared:
    def test_dismissed_when_no_soc_record(self):
        prev = [make_row(ref="20260101000001", revision=1)]
        curr: list[KBClaimRow] = []  # nothing this month
        ts = _diff(prev, curr)
        assert len(ts) == 1
        assert ts[0].transition == TransitionType.DISMISSED
        assert ts[0].soc_seen is False
        assert ts[0].current is None

    def test_settled_when_soc_history_has_any_revision(self):
        """Domain rule: query at base-key (claim) level; any revision
        in SOC history is enough to mark SETTLED, even if the SOC
        revision differs from the previous PLA revision."""
        prev = [make_row(ref="20260101000001", revision=0)]
        curr: list[KBClaimRow] = []
        soc = SOCHistory()
        soc.add(make_result(
            [make_row(ref="20260101000001", revision=2, sheet_kind=SHEET_KIND_SOC)],
            sheet_kind=SHEET_KIND_SOC,
        ))
        ts = _diff(prev, curr, soc)
        assert ts[0].transition == TransitionType.SETTLED
        assert ts[0].soc_seen is True


# ─── Appeared rows: NEW / REOPENED ─────────────────────────────────────────


class TestAppeared:
    def test_new_when_no_soc_history(self):
        prev: list[KBClaimRow] = []
        curr = [make_row(ref="20260201000001", revision=0)]
        ts = _diff(prev, curr)
        assert ts[0].transition == TransitionType.NEW
        assert ts[0].soc_seen is False
        assert ts[0].previous is None

    def test_reopened_when_soc_history_exists(self):
        prev: list[KBClaimRow] = []
        curr = [make_row(ref="20260201000001", revision=0)]
        soc = SOCHistory()
        soc.add(make_result(
            [make_row(ref="20260201000001", revision=2, sheet_kind=SHEET_KIND_SOC)],
            sheet_kind=SHEET_KIND_SOC,
        ))
        ts = _diff(prev, curr, soc)
        assert ts[0].transition == TransitionType.REOPENED


# ─── Edge cases ────────────────────────────────────────────────────────────


class TestEdgeCases:
    def test_first_month_all_appeared(self):
        """Empty previous → every current row becomes NEW (unless SOC
        history reopens it)."""
        prev: list[KBClaimRow] = []
        curr = [
            make_row(ref="20260201000001", revision=0, casualty="a"),
            make_row(ref="20260201000002", revision=0, casualty="b"),
            make_row(ref="20260201000003", revision=0, casualty="c"),
        ]
        ts = _diff(prev, curr)
        assert _by_type(ts) == {TransitionType.NEW: 3}

    def test_last_month_all_disappeared(self):
        prev = [
            make_row(ref="20260101000001", revision=0, casualty="a"),
            make_row(ref="20260101000002", revision=0, casualty="b"),
        ]
        curr: list[KBClaimRow] = []
        ts = _diff(prev, curr)
        assert _by_type(ts) == {TransitionType.DISMISSED: 2}

    def test_recipient_isolation(self):
        """An INS row and a DAEWOO row that differ only in recipient
        must be treated as separate claims — no diff matching across
        recipients."""
        prev = [make_row(ref="20260101000001", revision=0, recipient=INS_RECIPIENT)]
        curr = [make_row(ref="20260101000001", revision=0, recipient=DAEWOO_RECIPIENT)]
        # Each goes through its own stream — for this test we run both
        # streams via diff_monthly with assembled snapshots.
        prev_snap = KBMonthlySnapshot(
            year=2026, month=1,
            pla_ins=make_result(prev, recipient=INS_RECIPIENT),
        )
        curr_snap = KBMonthlySnapshot(
            year=2026, month=2,
            pla_daewoo=make_result(curr, recipient=DAEWOO_RECIPIENT),
        )
        ts = diff_monthly(prev_snap, curr_snap, _empty_history())
        kinds = _by_type(ts)
        # INS one disappeared (DISMISSED), DAEWOO one appeared (NEW).
        # No UNCHANGED because recipient is part of the matching key.
        assert kinds == {TransitionType.DISMISSED: 1, TransitionType.NEW: 1}

    def test_sibling_casualties_tracked_independently(self):
        """The 인001 / 물001 sibling pattern from Phase-1 fixtures: same
        ref/item/cession, different casualty. The diff engine treats
        each as its own base key — so one sibling can REVISION_BUMP
        while the other stays UNCHANGED in the same month."""
        prev = [
            make_row(ref="20230707020197", revision=0, casualty="인001 미상", row_index=78),
            make_row(ref="20230707020197", revision=0, casualty="물001 미상", row_index=79),
        ]
        curr = [
            make_row(ref="20230707020197", revision=1, casualty="인001 미상", row_index=78),
            make_row(ref="20230707020197", revision=0, casualty="물001 미상", row_index=79),
        ]
        ts = _diff(prev, curr)
        kinds = _by_type(ts)
        assert kinds == {
            TransitionType.REVISION_BUMP: 1,  # 인001
            TransitionType.UNCHANGED: 1,       # 물001
        }
        # And neither should carry a casualty-drift note: the 4-tuple
        # match exists, but it was already strict-matched on full
        # 5-tuple so the audit pass is never invoked.
        for t in ts:
            assert all(DRIFT_UNIQUE not in n for n in t.notes)

    def test_unparseable_ref_no_skipped_from_diff(self):
        """A row whose ref_no failed to parse can't be safely keyed,
        so the diff skips it. The parse warning lives on the source
        result; the diff output should be empty for that row's slot."""
        good = make_row(ref="20260101000001", revision=0)
        # Build a bad row by hand so we can inject ref_no=None.
        bad = KBClaimRow(
            sheet_kind=SHEET_KIND_PLA,
            recipient=INS_RECIPIENT,
            row_index=14,
            ref_no=None,
            insured="x",
            policy_no=None,
            lob=None,
            inception=None,
            expiry=None,
            dol=None,
            doc=None,
            revision=None,
            casualty="c",
            item_serial=1,
            cession_serial=1,
        )
        prev = [good, bad]
        curr = [good]
        ts = _diff(prev, curr)
        # The good row is UNCHANGED; the bad row contributed nothing.
        assert _by_type(ts) == {TransitionType.UNCHANGED: 1}

    def test_duplicate_base_key_in_one_snapshot_raises(self):
        """The diff relies on Phase-1's per-snapshot uniqueness
        invariant. If a snapshot somehow contains two rows with the
        same base key, fail loud."""
        rows = [
            make_row(ref="20260101000001", revision=0, casualty="x", row_index=13),
            make_row(ref="20260101000001", revision=0, casualty="x", row_index=14),
        ]
        with pytest.raises(KBSnapshotError, match="duplicate base key"):
            _diff(rows, [])


# ─── Pass-2 casualty drift audit ───────────────────────────────────────────


class TestCasualtyDriftAudit:
    """Pass 2 doesn't change the transition type; it only attaches a
    note so audit code can route the transition to human review.

    Three branches per the Step-1 decision:
    - unique near-match → ``casualty_drift_suspected:`` note
    - multiple near-match → ``casualty_ambiguous_with_siblings:`` note
    - no near-match → no note added
    """

    def test_unique_near_match_emits_drift_note_on_disappeared(self):
        # previous '미상' disappears; current has same ref/item/cession
        # but with casualty '김*숙' → unique 4-tuple match → drift suspect.
        prev = [make_row(ref="20260101000001", revision=0, casualty="미상")]
        curr = [make_row(ref="20260101000001", revision=1, casualty="김*숙")]
        ts = _diff(prev, curr)
        # The previous row appears as DISMISSED; the current row appears
        # as NEW. Both should carry the drift note.
        kinds = _by_type(ts)
        assert kinds == {TransitionType.DISMISSED: 1, TransitionType.NEW: 1}
        for t in ts:
            assert any(DRIFT_UNIQUE in n for n in t.notes), t.notes

    def test_unique_near_match_describes_direction(self):
        prev = [make_row(ref="20260101000001", revision=0, casualty="미상")]
        curr = [make_row(ref="20260101000001", revision=1, casualty="김*숙")]
        ts = _diff(prev, curr)
        dismissed = [t for t in ts if t.transition == TransitionType.DISMISSED][0]
        new = [t for t in ts if t.transition == TransitionType.NEW][0]
        assert any("previous casualty" in n and "may have become" in n
                   for n in dismissed.notes)
        assert any("current casualty" in n and "may have come from" in n
                   for n in new.notes)

    def test_ambiguous_match_with_two_siblings(self):
        """Three rows in current share ref/item/cession with two
        distinct casualties; the disappearing previous row could match
        either by 4-tuple → ambiguous note."""
        prev = [make_row(ref="20260101000001", revision=0, casualty="미상")]
        curr = [
            make_row(ref="20260101000001", revision=0, casualty="인001 미상", row_index=13),
            make_row(ref="20260101000001", revision=0, casualty="물001 미상", row_index=14),
        ]
        ts = _diff(prev, curr)
        # Previous '미상' disappears.
        dismissed = [t for t in ts if t.transition == TransitionType.DISMISSED][0]
        assert any(DRIFT_AMBIGUOUS in n for n in dismissed.notes)

    def test_no_match_emits_no_drift_note(self):
        """If nothing in the other side shares ref/item/cession at
        all, there's nothing to suspect. Stay silent."""
        prev = [make_row(ref="20260101000001", revision=0, casualty="미상")]
        curr = [make_row(ref="20269999999999", revision=0, casualty="다른")]
        ts = _diff(prev, curr)
        for t in ts:
            assert all(DRIFT_UNIQUE not in n for n in t.notes)
            assert all(DRIFT_AMBIGUOUS not in n for n in t.notes)

    def test_drift_does_not_change_transition_type(self):
        """Audit attaches notes only — the transition itself stays
        DISMISSED / NEW so the diff output remains predictable."""
        prev = [make_row(ref="20260101000001", revision=0, casualty="미상")]
        curr = [make_row(ref="20260101000001", revision=1, casualty="김*숙")]
        ts = _diff(prev, curr)
        types = {t.transition for t in ts}
        assert types == {TransitionType.DISMISSED, TransitionType.NEW}


# ─── Full snapshot integration ─────────────────────────────────────────────


class TestDiffMonthly:
    def test_diff_runs_both_recipient_streams(self):
        """``diff_monthly`` must compute INS and DAEWOO separately and
        concatenate. Mixing recipients in the inputs proves both
        streams ran."""
        prev = KBMonthlySnapshot(
            year=2026, month=1,
            pla_ins=make_result(
                [make_row(ref="20260101000001", revision=0, recipient=INS_RECIPIENT)],
                recipient=INS_RECIPIENT,
            ),
            pla_daewoo=make_result(
                [make_row(ref="20260101000002", revision=0, recipient=DAEWOO_RECIPIENT)],
                recipient=DAEWOO_RECIPIENT,
            ),
        )
        curr = KBMonthlySnapshot(
            year=2026, month=2,
            pla_ins=make_result(
                [make_row(ref="20260101000001", revision=1, recipient=INS_RECIPIENT)],
                recipient=INS_RECIPIENT,
            ),
            pla_daewoo=make_result(
                [make_row(ref="20260101000002", revision=0, recipient=DAEWOO_RECIPIENT)],
                recipient=DAEWOO_RECIPIENT,
            ),
        )
        ts = diff_monthly(prev, curr, _empty_history())
        kinds = _by_type(ts)
        assert kinds == {
            TransitionType.REVISION_BUMP: 1,
            TransitionType.UNCHANGED: 1,
        }

    def test_only_ins_stream_present(self):
        prev = KBMonthlySnapshot(
            year=2026, month=1,
            pla_ins=make_result([make_row()]),
        )
        curr = KBMonthlySnapshot(
            year=2026, month=2,
            pla_ins=make_result([make_row()]),
        )
        ts = diff_monthly(prev, curr, _empty_history())
        assert _by_type(ts) == {TransitionType.UNCHANGED: 1}

    def test_only_daewoo_stream_present(self):
        prev = KBMonthlySnapshot(
            year=2026, month=1,
            pla_daewoo=make_result(
                [make_row(recipient=DAEWOO_RECIPIENT)],
                recipient=DAEWOO_RECIPIENT,
            ),
        )
        curr = KBMonthlySnapshot(
            year=2026, month=2,
            pla_daewoo=make_result(
                [make_row(recipient=DAEWOO_RECIPIENT)],
                recipient=DAEWOO_RECIPIENT,
            ),
        )
        ts = diff_monthly(prev, curr, _empty_history())
        assert _by_type(ts) == {TransitionType.UNCHANGED: 1}
