"""Tests for the UNVERIFIED HW ref-no draft parser.

These tests pin the regex shapes that were inferred from a 515-row DB
audit and one Hanwha SOC email screenshot. Their pass/fail status is
not authoritative — the source of truth (real HW document fixtures) is
not available yet.

When Phase 2 onboards real HW fixtures, treat any test here that
disagrees with the live shape as the test that needs to change, not
the parser.
"""

from __future__ import annotations

import pytest

from app.services.parsers._unverified.hw_ref_no_draft import parse_hw_ref_no_draft
from app.services.parsers.errors import RefNoParseError


class TestHWModern:
    def test_modern_decomposes_year_month_day_serial(self):
        r = parse_hw_ref_no_draft("25091916949")
        assert r.cedant == "HW"
        assert r.format_variant == "hw_modern"
        assert r.year == 2025
        assert r.month == 9
        assert r.day == 19
        assert r.serial == "16949"
        assert r.normalized == "25091916949"
        assert r.key == "25091916949"

    def test_two_digit_year_window_uses_2000s_for_low_yy(self):
        r = parse_hw_ref_no_draft("05010100001")
        assert r.year == 2005

    def test_invalid_month_kept_as_note(self):
        r = parse_hw_ref_no_draft("25131900001")
        assert r.month is None
        assert any("invalid month" in n for n in r.notes)


class TestHWLettered:
    def test_basic_lettered(self):
        r = parse_hw_ref_no_draft("202204L4731")
        assert r.format_variant == "hw_lettered"
        assert r.year == 2022
        assert r.month == 4
        assert r.line_code == "L"
        assert r.serial == "4731"

    def test_lettered_short_serial(self):
        r = parse_hw_ref_no_draft("201909X503")
        assert r.line_code == "X"
        assert r.serial == "503"

    def test_lettered_with_cargo_tag(self):
        r = parse_hw_ref_no_draft("201505E3621(Cargo)")
        assert r.line_code == "E"
        assert any("Cargo" in n for n in r.notes)


class TestHWPrefixedShapes:
    def test_rf_prefix(self):
        r = parse_hw_ref_no_draft("RF100035671")
        assert r.format_variant == "hw_rf"
        assert r.serial == "100035671"

    def test_c_prefix_short(self):
        r = parse_hw_ref_no_draft("C2023020370509-1-16")
        assert r.format_variant == "hw_c"
        assert r.year == 2023
        assert r.month == 2
        assert r.revision == 16

    def test_c_prefix_with_extra_dash_segments(self):
        r = parse_hw_ref_no_draft("C2011040107575-1-2-2012100301")
        assert r.format_variant == "hw_c"
        assert r.year == 2011
        assert r.revision == 2012100301


class TestHWSentinels:
    @pytest.mark.parametrize("raw", ["2nd", "3rd", "Typhoon CHABA", "Earthquake 2016"])
    def test_known_sentinels(self, raw):
        r = parse_hw_ref_no_draft(raw)
        assert r.is_sentinel is True
        assert r.format_variant == "sentinel"

    def test_unknown_format_raises(self):
        with pytest.raises(RefNoParseError):
            parse_hw_ref_no_draft("BLAHBLAH")

    def test_empty_raises(self):
        with pytest.raises(RefNoParseError):
            parse_hw_ref_no_draft("")
