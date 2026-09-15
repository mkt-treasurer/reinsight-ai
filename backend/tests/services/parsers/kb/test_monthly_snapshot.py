"""Tests for :class:`KBMonthlySnapshot` validation."""

from __future__ import annotations

import pytest

from app.services.parsers.kb import KBMonthlySnapshot, KBSnapshotError
from app.services.parsers.kb_bordereau import SHEET_KIND_PLA, SHEET_KIND_SOC

from ._builders import (
    DAEWOO_RECIPIENT,
    INS_RECIPIENT,
    make_result,
    make_row,
)


def _pla(recipient: str = INS_RECIPIENT):
    return make_result(
        [make_row(recipient=recipient, sheet_kind=SHEET_KIND_PLA)],
        sheet_kind=SHEET_KIND_PLA,
        recipient=recipient,
    )


def _soc(recipient: str = INS_RECIPIENT):
    return make_result(
        [make_row(recipient=recipient, sheet_kind=SHEET_KIND_SOC)],
        sheet_kind=SHEET_KIND_SOC,
        recipient=recipient,
    )


class TestValidation:
    def test_requires_at_least_one_pla(self):
        with pytest.raises(KBSnapshotError, match="at least one PLA"):
            KBMonthlySnapshot(year=2026, month=2)

    def test_pla_only_in_either_slot_is_fine(self):
        s1 = KBMonthlySnapshot(year=2026, month=2, pla_ins=_pla(INS_RECIPIENT))
        s2 = KBMonthlySnapshot(year=2026, month=2, pla_daewoo=_pla(DAEWOO_RECIPIENT))
        assert s1.pla_ins is not None and s1.pla_daewoo is None
        assert s2.pla_ins is None and s2.pla_daewoo is not None

    def test_pla_slot_with_soc_result_raises(self):
        # Putting a SOC result into a PLA slot is a wiring bug.
        soc_in_pla_slot = make_result(
            [make_row(sheet_kind=SHEET_KIND_SOC)],
            sheet_kind=SHEET_KIND_SOC,
        )
        with pytest.raises(KBSnapshotError, match="sheet_kind"):
            KBMonthlySnapshot(year=2026, month=2, pla_ins=soc_in_pla_slot)

    def test_soc_slot_with_pla_result_raises(self):
        pla_in_soc_slot = _pla()
        with pytest.raises(KBSnapshotError, match="sheet_kind"):
            KBMonthlySnapshot(
                year=2026, month=2,
                pla_ins=_pla(),
                soc_ins=pla_in_soc_slot,
            )

    @pytest.mark.parametrize("month", [0, 13, -1, 999])
    def test_month_out_of_range(self, month):
        with pytest.raises(KBSnapshotError, match="month"):
            KBMonthlySnapshot(year=2026, month=month, pla_ins=_pla())

    @pytest.mark.parametrize("year", [1899, 2101, 0])
    def test_year_out_of_range(self, year):
        with pytest.raises(KBSnapshotError, match="year"):
            KBMonthlySnapshot(year=year, month=2, pla_ins=_pla())


class TestAccessors:
    def test_pla_results_filters_none(self):
        s = KBMonthlySnapshot(year=2026, month=2, pla_ins=_pla())
        assert len(s.pla_results()) == 1
        s2 = KBMonthlySnapshot(
            year=2026, month=2,
            pla_ins=_pla(INS_RECIPIENT),
            pla_daewoo=_pla(DAEWOO_RECIPIENT),
        )
        assert len(s2.pla_results()) == 2

    def test_soc_results_filters_none(self):
        s = KBMonthlySnapshot(year=2026, month=2, pla_ins=_pla(), soc_ins=_soc())
        assert len(s.soc_results()) == 1

    def test_label_uses_zero_padded_month(self):
        s = KBMonthlySnapshot(year=2026, month=2, pla_ins=_pla())
        assert s.label == "2026-02"
