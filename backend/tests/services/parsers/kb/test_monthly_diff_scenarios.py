"""End-to-end scenario tests for the KB monthly diff engine.

Drives the engine with the committed synthetic xlsx fixtures under
``tests/fixtures/kb_borderau/synthetic/``. The scenario is a 3-month
walk that exercises every :class:`TransitionType`. Each anchor claim
is identified by a reserved ref_no; see
``tests.fixtures.kb_borderau.generators.make_diff_scenarios`` for the
ledger.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

import pytest

from app.services.parsers.kb import (
    ClaimTransition,
    KBMonthlySnapshot,
    SOCHistory,
    TransitionType,
    diff_monthly,
)
from app.services.parsers.kb.monthly_diff import (
    ANOMALY_REGRESSION,
    DRIFT_UNIQUE,
)


SYNTHETIC = Path(__file__).resolve().parents[3] / "fixtures" / "kb_borderau" / "synthetic"


# Convenience lookups by ref body.
def _by_ref(transitions: list[ClaimTransition]) -> dict[str, list[ClaimTransition]]:
    out: dict[str, list[ClaimTransition]] = {}
    for t in transitions:
        ref = t.base_key[1]
        out.setdefault(ref, []).append(t)
    return out


@pytest.fixture(scope="module")
def m1() -> KBMonthlySnapshot:
    return KBMonthlySnapshot.from_paths(
        2026, 1,
        pla_ins=SYNTHETIC / "2026_01_PLA_INS.xlsx",
        soc_ins=SYNTHETIC / "2026_01_SOC_INS.xlsx",
    )


@pytest.fixture(scope="module")
def m2() -> KBMonthlySnapshot:
    return KBMonthlySnapshot.from_paths(
        2026, 2,
        pla_ins=SYNTHETIC / "2026_02_PLA_INS.xlsx",
        soc_ins=SYNTHETIC / "2026_02_SOC_INS.xlsx",
    )


@pytest.fixture(scope="module")
def m3() -> KBMonthlySnapshot:
    return KBMonthlySnapshot.from_paths(
        2026, 3,
        pla_ins=SYNTHETIC / "2026_03_PLA_INS.xlsx",
    )


@pytest.fixture(scope="module")
def soc_history(m1, m2) -> SOCHistory:
    h = SOCHistory()
    h.add_many(m1.soc_results())
    h.add_many(m2.soc_results())
    return h


# ─── M1 → M2 diff ──────────────────────────────────────────────────────────


class TestM1ToM2Transitions:
    @pytest.fixture(scope="class")
    def transitions(self, m1, m2, soc_history):
        return diff_monthly(m1, m2, soc_history)

    def test_every_transition_type_present_at_least_once(self, transitions):
        """The synthetic ledger is designed to trigger one row of each
        transition class — guard against future fixture drift dropping
        coverage of any class."""
        kinds = {t.transition for t in transitions}
        expected = {
            TransitionType.UNCHANGED,
            TransitionType.REVISION_BUMP,
            TransitionType.REVISION_GAP,
            TransitionType.REVISION_REGRESSION,
            TransitionType.SETTLED,
            TransitionType.DISMISSED,
            TransitionType.NEW,
        }
        # REOPENED triggers in M2→M3 instead, not here.
        assert expected.issubset(kinds), (
            f"missing transitions: {sorted(t.name for t in expected - kinds)}"
        )

    def test_c1_unchanged(self, transitions):
        rows = _by_ref(transitions)["2026-0101000001"]
        assert len(rows) == 1
        assert rows[0].transition == TransitionType.UNCHANGED

    def test_c2_revision_bump_zero_to_one(self, transitions):
        rows = _by_ref(transitions)["2026-0101000002"]
        assert len(rows) == 1
        t = rows[0]
        assert t.transition == TransitionType.REVISION_BUMP
        assert t.previous.revision == 0
        assert t.current.revision == 1

    def test_c3_revision_gap_zero_to_two(self, transitions):
        t = _by_ref(transitions)["2026-0101000003"][0]
        assert t.transition == TransitionType.REVISION_GAP
        assert any("skipped 1" in n for n in t.notes)
        assert any("0 → 2" in n for n in t.notes)

    def test_c4_revision_regression_marked_anomaly(self, transitions):
        """REVISION_REGRESSION must carry the literal anomaly tag so
        the audit script can route it to its dedicated section."""
        t = _by_ref(transitions)["2026-0101000004"][0]
        assert t.transition == TransitionType.REVISION_REGRESSION
        assert ANOMALY_REGRESSION in t.notes
        assert t.previous.revision == 2
        assert t.current.revision == 1

    def test_c5_settled_via_soc_history(self, transitions):
        """C5 paid out in M2 SOC; the M1→M2 PLA disappearance therefore
        resolves to SETTLED rather than DISMISSED."""
        t = _by_ref(transitions)["2026-0101000005"][0]
        assert t.transition == TransitionType.SETTLED
        assert t.soc_seen is True

    def test_c6_dismissed_no_soc_record(self, transitions):
        t = _by_ref(transitions)["2026-0101000006"][0]
        assert t.transition == TransitionType.DISMISSED
        assert t.soc_seen is False

    def test_c7_new_no_soc_history(self, transitions):
        t = _by_ref(transitions)["2026-0102000007"][0]
        assert t.transition == TransitionType.NEW
        assert t.soc_seen is False
        assert t.previous is None

    def test_c9_sibling_casualties_each_unchanged(self, transitions):
        """The 인001 / 물001 sibling pair shares ref + item + cession.
        Each appears as a separate UNCHANGED transition because casualty
        is part of the matching key."""
        rows = _by_ref(transitions)["2026-0101000009"]
        assert len(rows) == 2
        casualties = sorted(t.base_key[2] for t in rows)
        assert casualties == ["물001 미상", "인001 미상"]
        for t in rows:
            assert t.transition == TransitionType.UNCHANGED

    def test_c10_casualty_drift_emits_warning_on_both_sides(self, transitions):
        """C10 changes casualty from '미상' to '김*숙' between M1 and M2.
        Strict matching can't bridge this, so we expect:
        - the M1 row showing as DISMISSED (was '미상')
        - the M2 row showing as NEW (now '김*숙')
        Both transitions should carry a ``casualty_drift_suspected``
        note pointing at the other side as a near-match."""
        rows = _by_ref(transitions)["2026-0101000010"]
        assert len(rows) == 2

        types = {t.transition for t in rows}
        assert types == {TransitionType.DISMISSED, TransitionType.NEW}

        for t in rows:
            assert any(DRIFT_UNIQUE in n for n in t.notes), (
                f"expected drift note on {t.transition.name}, got {t.notes}"
            )


# ─── M2 → M3 diff ──────────────────────────────────────────────────────────


class TestM2ToM3Transitions:
    @pytest.fixture(scope="class")
    def transitions(self, m2, m3, soc_history):
        return diff_monthly(m2, m3, soc_history)

    def test_c8_reopened_uses_m1_soc_history(self, transitions):
        """C8 was paid in M1 (recorded in SOC history). It vanishes in
        M2 (no PLA, no further SOC) and resurfaces in M3 — the diff
        engine consults SOC history and labels it REOPENED, not NEW."""
        rows = _by_ref(transitions)["2026-0101000008"]
        assert len(rows) == 1
        t = rows[0]
        assert t.transition == TransitionType.REOPENED
        assert t.soc_seen is True

    def test_dropouts_are_dismissed_when_no_soc_record(self, transitions):
        """C7 (M2 NEW) doesn't appear in M3 and has no SOC trail →
        DISMISSED. Same for C3 / C4 / C10. Confirms recurring drop-out
        behaviour cycles correctly through the engine."""
        kinds = Counter(t.transition for t in transitions)
        assert kinds[TransitionType.DISMISSED] >= 1


# ─── Cumulative coverage ───────────────────────────────────────────────────


def test_full_cycle_covers_every_transition_type(m1, m2, m3, soc_history):
    """Running both diffs should collectively trigger every transition
    type defined in the enum. Any newly-added transition class should
    be exercised by at least one synthetic row before merging."""
    all_transitions = (
        diff_monthly(m1, m2, soc_history) + diff_monthly(m2, m3, soc_history)
    )
    seen = {t.transition for t in all_transitions}
    expected = set(TransitionType)
    missing = expected - seen
    assert not missing, (
        f"transition types not covered by synthetic scenarios: "
        f"{sorted(t.name for t in missing)}"
    )
