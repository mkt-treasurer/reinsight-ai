"""Unit tests for KB reference-number parsing.

These tests pin both the canonical normalised display form (DB-compat
with whitespace) and the new whitespace-free ``key`` form so a
regression on either surface fails loudly rather than silently
breaking joins or URL routing.
"""

from __future__ import annotations

import pytest

from app.services.parsers.errors import RefNoParseError
from app.services.parsers.ref_no_parser import parse_kb_ref_no


# ─── KB: canonical Excel-source shape ──────────────────────────────────────


class TestKBExcelSource:
    """Excel source: 14-digit ``접수번호`` + integer revision column."""

    def test_modern_with_revision(self):
        r = parse_kb_ref_no("20260204009404", revision=1)
        assert r.cedant == "KB"
        assert r.normalized == "2026-0204009404 001"
        assert r.key == "2026-0204009404-001"
        assert r.format_variant == "kb_modern"
        assert r.year == 2026
        assert r.month == 2
        assert r.day == 4
        assert r.serial == "009404"
        assert r.revision == 1
        assert r.is_sentinel is False
        assert r.notes == ()

    def test_revision_zero_pads_to_three_digits(self):
        r = parse_kb_ref_no("20251016037951", revision=2)
        assert r.normalized == "2025-1016037951 002"
        assert r.key == "2025-1016037951-002"
        assert r.revision == 2

    def test_revision_zero_value(self):
        r = parse_kb_ref_no("20241010024078", revision=0)
        assert r.normalized == "2024-1010024078 000"
        assert r.key == "2024-1010024078-000"
        assert r.revision == 0

    def test_revision_high_three_digits(self):
        r = parse_kb_ref_no("20160001191241", revision=48)
        assert r.normalized == "2016-0001191241 048"
        assert r.key == "2016-0001191241-048"
        assert r.revision == 48

    def test_no_revision_provided(self):
        r = parse_kb_ref_no("20260204009404")
        assert r.normalized == "2026-0204009404"
        assert r.key == "2026-0204009404"
        assert r.revision is None


# ─── KB: DB-stored shapes (already concatenated) ───────────────────────────


class TestKBDBStored:
    """DB-stored: revision is part of the string."""

    @pytest.mark.parametrize(
        "raw,year,month,day,rev,normalized,key",
        [
            ("2026-0204009404 001", 2026, 2, 4, 1, "2026-0204009404 001", "2026-0204009404-001"),
            ("2024-1105009358 001", 2024, 11, 5, 1, "2024-1105009358 001", "2024-1105009358-001"),
            ("20180000587752 001", 2018, 0, 0, 1, "2018-0000587752 001", "2018-0000587752-001"),
            ("2024-0716005197", 2024, 7, 16, None, "2024-0716005197", "2024-0716005197"),
        ],
    )
    def test_canonical_db_forms(self, raw, year, month, day, rev, normalized, key):
        r = parse_kb_ref_no(raw)
        assert r.year == year
        assert r.revision == rev
        assert r.normalized == normalized
        assert r.key == key

    def test_legacy_no_hyphen_no_rev(self):
        r = parse_kb_ref_no("20180001619249")
        # Older form without hyphen: month/day decode as 00/01 which is
        # invalid, so we mark the variant opaque but still normalise.
        assert r.format_variant == "kb_legacy_opaque"
        assert r.month is None
        assert r.day is None
        assert r.normalized == "2018-0001619249"
        assert r.key == "2018-0001619249"
        assert any("month=00" in n for n in r.notes)


# ─── KB: revision interaction edge cases ───────────────────────────────────


class TestKBRevisionEdges:
    def test_parameter_wins_on_conflict(self):
        # If both an embedded revision and a parameter come in, trust
        # the parameter (it came straight from the source column) but
        # surface the conflict in notes.
        r = parse_kb_ref_no("2026-0204009404 002", revision=5)
        assert r.revision == 5
        assert r.normalized == "2026-0204009404 005"
        assert r.key == "2026-0204009404-005"
        assert any("conflict" in n for n in r.notes)

    def test_parameter_matches_embedded_no_warning(self):
        r = parse_kb_ref_no("2026-0204009404 003", revision=3)
        assert r.revision == 3
        assert all("conflict" not in n for n in r.notes)

    def test_non_three_digit_embedded_revision_warns(self):
        # Real-data anomaly: '20160003733162 0012' has 4-digit revision.
        r = parse_kb_ref_no("20160003733162 0012")
        assert r.revision == 12
        assert any("non-canonical revision width" in n for n in r.notes)


# ─── KB: anomalies and non-data sentinels ──────────────────────────────────


class TestKBAnomalies:
    def test_multi_claim_extension_suffix(self):
        r = parse_kb_ref_no("2015-0000661630외")
        assert r.normalized.endswith("외")
        # Key preserves 외 so the two refs ``2015-0000661630`` and
        # ``2015-0000661630외`` don't collide on a clean-key join.
        assert r.key.endswith("외")
        assert any("외" in n for n in r.notes)

    def test_various_is_sentinel(self):
        r = parse_kb_ref_no("various")
        assert r.is_sentinel is True
        assert r.format_variant == "sentinel"
        assert r.normalized == "various"
        assert r.key == "various"

    def test_whitespace_stripped(self):
        r = parse_kb_ref_no("   20260204009404   ", revision=1)
        assert r.year == 2026
        assert r.key == "2026-0204009404-001"

    def test_internal_whitespace_collapsed(self):
        # Embedded extra spaces sometimes come from copy-paste.
        r = parse_kb_ref_no("2026-0204009404  001")
        assert r.revision == 1

    def test_legacy_c_prefix_rejected(self):
        # 'C2018030909145-1-3' rows live in the cedant=KB partition due
        # to historical data quality issues, but they aren't valid KB
        # ref numbers — caller should drop / quarantine these rows.
        with pytest.raises(RefNoParseError):
            parse_kb_ref_no("C2018030909145-1-3")

    def test_empty_string_raises(self):
        with pytest.raises(RefNoParseError):
            parse_kb_ref_no("")

    def test_none_raises(self):
        with pytest.raises(RefNoParseError):
            parse_kb_ref_no(None)  # type: ignore[arg-type]

    def test_wildly_malformed_raises(self):
        with pytest.raises(RefNoParseError):
            parse_kb_ref_no("not-a-ref-number")

    def test_year_out_of_range_raises(self):
        with pytest.raises(RefNoParseError):
            parse_kb_ref_no("18800001619249")


# ─── Key vs display invariants ─────────────────────────────────────────────


class TestKeyVsDisplay:
    """``key`` is the new ASCII-clean identifier; ``normalized`` keeps
    the historical whitespace separator for DB compatibility. Ensure
    they only differ where they should."""

    def test_key_has_no_whitespace_for_canonical_kb_refs(self):
        r = parse_kb_ref_no("20260204009404", revision=1)
        assert " " not in r.key
        assert " " in r.normalized  # display form keeps the space

    def test_key_and_normalized_match_when_no_revision(self):
        r = parse_kb_ref_no("2024-0716005197")
        assert r.key == r.normalized

    def test_key_replaces_only_the_revision_separator(self):
        # The hyphen between year and core stays; only the revision
        # separator changes from space to hyphen.
        r = parse_kb_ref_no("2026-0204009404 001")
        assert r.key == "2026-0204009404-001"
        # Replacing the hyphen-to-space substitution should round-trip
        # back to the display form.
        assert r.key.replace("-001", " 001") == r.normalized


class TestIncidentBody:
    """``body`` exposes the ref base with the revision suffix stripped,
    so that successive billings of the same incident
    (``2020-1021024610 001``/``002``/``003``) collapse to one identity.
    """

    def test_body_strips_revision_suffix(self):
        r = parse_kb_ref_no("2020-1021024610 001")
        assert r.body == "2020-1021024610"
        assert r.revision == 1

    def test_body_matches_across_revisions_of_same_incident(self):
        # Real customer case from KB SOC PDF: five successive billings
        # of the same loss. ``body`` must be identical so we can
        # group them as one incident.
        bodies = {
            parse_kb_ref_no(f"2020-1021024610 {seq:03d}").body
            for seq in (1, 2, 3, 4, 5)
        }
        assert bodies == {"2020-1021024610"}

    def test_body_equals_key_when_no_revision(self):
        r = parse_kb_ref_no("2024-0716005197")
        assert r.body == r.key == "2024-0716005197"

    def test_body_when_revision_passed_separately(self):
        # 14-digit core form from the Excel ``접수번호`` cell with the
        # revision in a sibling column — same body as the DB-stored form.
        r = parse_kb_ref_no("20201021024610", revision=1)
        assert r.body == "2020-1021024610"

    def test_body_strips_oe_suffix(self):
        # ``외`` means "and others" — aggregation marker, not a
        # revision. Body must drop it so aggregated rows still group
        # with their non-aggregated siblings.
        r = parse_kb_ref_no("2026-0204009404 001외")
        assert r.body == "2026-0204009404"
        assert r.revision == 1

    def test_body_strips_oe_suffix_without_revision(self):
        r = parse_kb_ref_no("2026-0204009404외")
        assert r.body == "2026-0204009404"
        assert r.revision is None

    def test_body_for_kb_legacy_opaque(self):
        # MM=00 legacy rows still produce a valid body (we can't
        # decode month/day, but the ref base is well-formed).
        r = parse_kb_ref_no("2013-0000539637 155")
        assert r.body == "2013-0000539637"
        assert r.revision == 155
        assert r.format_variant == "kb_legacy_opaque"

    def test_body_for_non_canonical_revision_width(self):
        # 2-digit revision (deviates from KB's usual 3-digit zero-pad,
        # surfaces a note but does not raise). Body still strips it.
        r = parse_kb_ref_no("2026-0204009404 12")
        assert r.body == "2026-0204009404"
        assert r.revision == 12

    def test_body_for_sentinel_returns_key(self):
        # Sentinel ref ("various") has no incident structure — body
        # is just the sentinel value itself. Callers must check
        # ``is_sentinel`` before relying on body for grouping.
        r = parse_kb_ref_no("various")
        assert r.is_sentinel
        assert r.body == "various"
