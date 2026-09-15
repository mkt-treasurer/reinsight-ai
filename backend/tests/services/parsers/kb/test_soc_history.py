"""Unit tests for :class:`SOCHistory`.

Pin the storage / query split:
- stored at the 6-tuple natural-key level (revision-aware)
- queried at the 5-tuple base-key level (revision-agnostic)
"""

from __future__ import annotations

import pytest

from app.services.parsers.kb import SOCHistory
from app.services.parsers.kb.soc_history import row_base_key
from app.services.parsers.kb_bordereau import SHEET_KIND_PLA, SHEET_KIND_SOC

from ._builders import make_result, make_row


class TestStorageAndQuery:
    def test_empty_history_returns_false_for_anything(self):
        h = SOCHistory()
        assert h.has_seen(("INS", "key", None, 1, 1)) is False
        assert ("INS", "key", None, 1, 1) not in h
        assert len(h) == 0

    def test_add_records_full_keys(self):
        h = SOCHistory()
        result = make_result(
            [make_row(ref="20260101000001", revision=1, sheet_kind=SHEET_KIND_SOC)],
            sheet_kind=SHEET_KIND_SOC,
        )
        added = h.add(result)
        assert added == 1
        assert len(h) == 1

    def test_query_at_base_key_strips_revision(self):
        """Adding revision=1 should make ``has_seen`` return True for
        the matching 5-tuple regardless of which revision is asked."""
        h = SOCHistory()
        h.add(make_result(
            [make_row(ref="20260101000001", revision=3, sheet_kind=SHEET_KIND_SOC)],
            sheet_kind=SHEET_KIND_SOC,
        ))
        # Query with a different revision under the same claim — the
        # 5-tuple base key is computed from a row builder regardless
        # of the revision passed.
        probe = make_row(ref="20260101000001", revision=99)
        base = row_base_key(probe)
        assert h.has_seen(base) is True

    def test_revisions_seen_collects_all_revisions(self):
        h = SOCHistory()
        rows = [
            make_row(ref="20260101000001", revision=1, sheet_kind=SHEET_KIND_SOC, row_index=13),
            make_row(ref="20260101000001", revision=2, sheet_kind=SHEET_KIND_SOC, row_index=14),
            make_row(ref="20260101000001", revision=4, sheet_kind=SHEET_KIND_SOC, row_index=15),
        ]
        h.add(make_result(rows, sheet_kind=SHEET_KIND_SOC))
        base = row_base_key(rows[0])
        assert h.revisions_seen(base) == frozenset({1, 2, 4})
        # Query semantics: any revision under this base counts.
        assert h.has_seen(base) is True

    def test_revisions_seen_empty_for_unknown_base(self):
        assert SOCHistory().revisions_seen(("INS", "key", None, 1, 1)) == frozenset()

    def test_add_many_accumulates(self):
        h = SOCHistory()
        results = [
            make_result(
                [make_row(ref=f"2026010100000{i}", revision=1, sheet_kind=SHEET_KIND_SOC)],
                sheet_kind=SHEET_KIND_SOC,
                file_name=f"r{i}.xlsx",
            )
            for i in range(1, 4)
        ]
        added = h.add_many(results)
        assert added == 3
        assert len(h) == 3


class TestStorageInvariants:
    def test_add_rejects_pla_result(self):
        """SOCHistory only takes SOC sheets — feeding a PLA in is
        almost always a wiring bug, so fail loudly."""
        h = SOCHistory()
        pla = make_result(
            [make_row(sheet_kind=SHEET_KIND_PLA)],
            sheet_kind=SHEET_KIND_PLA,
        )
        with pytest.raises(ValueError, match="sheet_kind=SOC"):
            h.add(pla)

    def test_unparseable_rows_skipped_silently(self):
        """A row whose ref_no failed to parse can't be safely keyed.
        Skip from accumulation; don't blow up the batch."""
        h = SOCHistory()
        good = make_row(ref="20260101000001", revision=1, sheet_kind=SHEET_KIND_SOC)
        # Manually construct a row with ref_no=None to mimic a parse failure.
        from app.services.parsers.kb_bordereau import KBClaimRow
        bad = KBClaimRow(
            sheet_kind=SHEET_KIND_SOC,
            recipient=good.recipient,
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
        result = make_result([good, bad], sheet_kind=SHEET_KIND_SOC)
        added = h.add(result)
        # Only the good row counts — bad row had no parseable ref_no.
        assert added == 1
        assert len(h) == 1

    def test_has_seen_validates_tuple_length(self):
        h = SOCHistory()
        with pytest.raises(ValueError, match="5-tuple"):
            h.has_seen(("INS", "key", None, 1))  # 4-tuple

    def test_dedup_within_same_full_key(self):
        """Adding the same SOC row twice (e.g., two months of files
        both list it) shouldn't double-count."""
        h = SOCHistory()
        row = make_row(ref="20260101000001", revision=1, sheet_kind=SHEET_KIND_SOC)
        result = make_result([row], sheet_kind=SHEET_KIND_SOC)
        h.add(result)
        new = h.add(result)
        assert new == 0  # nothing new the second time
        assert len(h) == 1
