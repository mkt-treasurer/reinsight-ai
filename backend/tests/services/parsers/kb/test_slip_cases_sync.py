"""Unit tests for the slip_cases → SOCHistory adapter.

Covers JSONB extraction (claims[] array, top-level ref, comma lists),
quality grading boundaries, recipient heuristic, and partial-tier
SOCHistory integration. All tests use in-memory dicts; the live DB
read path is deferred to Phase 3c.
"""

from __future__ import annotations

import pytest

from app.services.parsers.kb import (
    DAEWOO_RECIPIENT,
    DEFAULT_INS_RECIPIENT,
    ExtractedKey,
    QUALITY_INFERRED,
    QUALITY_PARTIAL,
    SOCHistory,
    SlipCasesAdapter,
    SlipCasesSyncReport,
    extract_keys_from_slip_case,
)


# ─── Helpers ───────────────────────────────────────────────────────────────


def _slip_case(
    *,
    case_id: str = "case-1",
    cedant: str | None = "KB",
    ref_no: str | None = None,
    claims: list | None = None,
    input_files: list | None = None,
    **extra,
) -> dict:
    """Build a slip_cases row matching the production JSONB shape."""
    extracted: dict = {"cedant": cedant} if cedant is not None else {}
    if ref_no is not None:
        extracted["ref_no"] = ref_no
    if claims is not None:
        extracted["claims"] = claims
    extracted.update(extra)
    return {
        "id": case_id,
        "extracted": extracted,
        "input_files": input_files or [],
    }


# ─── Recipient heuristic ───────────────────────────────────────────────────


class TestRecipientInference:
    def test_daewoo_in_filename_yields_daewoo(self):
        row = _slip_case(
            ref_no="2026-0204009404 001",
            input_files=[{"name": "PLA_FAC_INS(DAEWOO)_2026.02.pdf"}],
        )
        keys, _ = extract_keys_from_slip_case(row)
        assert keys[0].recipient == DAEWOO_RECIPIENT

    def test_daewoo_match_is_case_insensitive(self):
        row = _slip_case(
            ref_no="2026-0204009404 001",
            input_files=[{"name": "soc_daewoo_february.pdf"}],
        )
        keys, _ = extract_keys_from_slip_case(row)
        assert keys[0].recipient == DAEWOO_RECIPIENT

    def test_no_daewoo_falls_back_to_ins_default(self):
        row = _slip_case(
            ref_no="2026-0204009404 001",
            input_files=[{"name": "KB SOC Munich Re_Travel.pdf"}],
        )
        keys, _ = extract_keys_from_slip_case(row)
        assert keys[0].recipient == DEFAULT_INS_RECIPIENT

    def test_empty_input_files_falls_back_to_ins_default(self):
        row = _slip_case(ref_no="2026-0204009404 001")
        keys, _ = extract_keys_from_slip_case(row)
        assert keys[0].recipient == DEFAULT_INS_RECIPIENT


# ─── claims[] array extraction ─────────────────────────────────────────────


class TestClaimsArrayExtraction:
    def test_extracts_one_key_per_claim_row(self):
        row = _slip_case(
            claims=[
                {"cedant_ref_no": "2024-1105009358 001"},
                {"cedant_ref_no": "2024-1105009358 002"},
            ],
        )
        keys, reasons = extract_keys_from_slip_case(row)
        assert reasons == []
        assert len(keys) == 2
        assert {k.revision for k in keys} == {1, 2}
        assert all(k.ref_body == "2024-1105009358" for k in keys)

    def test_skips_claim_without_cedant_ref_no(self):
        row = _slip_case(
            claims=[
                {"cedant_ref_no": "2024-1105009358 001"},
                {"insured": "x"},
            ],
        )
        keys, reasons = extract_keys_from_slip_case(row)
        assert len(keys) == 1
        assert any("missing cedant_ref_no" in r for r in reasons)

    def test_skips_claim_with_unparseable_ref(self):
        row = _slip_case(
            claims=[
                {"cedant_ref_no": "2024-1105009358 001"},
                {"cedant_ref_no": "GARBAGE-REF"},
            ],
        )
        keys, reasons = extract_keys_from_slip_case(row)
        assert len(keys) == 1
        assert any("unparseable" in r for r in reasons)

    def test_falls_back_to_ref_no_inside_claim(self):
        # Some legacy slip_cases use 'ref_no' instead of 'cedant_ref_no'
        # inside claim elements.
        row = _slip_case(
            claims=[{"ref_no": "2024-1105009358 003"}],
        )
        keys, _ = extract_keys_from_slip_case(row)
        assert len(keys) == 1
        assert keys[0].revision == 3


# ─── Top-level ref_no fallback ─────────────────────────────────────────────


class TestTopLevelRefFallback:
    def test_used_when_claims_array_absent(self):
        row = _slip_case(ref_no="2024-1105009358 001")
        keys, _ = extract_keys_from_slip_case(row)
        assert len(keys) == 1
        assert keys[0].revision == 1

    def test_comma_separated_list_split_into_multiple_keys(self):
        row = _slip_case(ref_no="2024-1105009358 001, 2024-1105009358 002")
        keys, _ = extract_keys_from_slip_case(row)
        assert len(keys) == 2
        assert {k.revision for k in keys} == {1, 2}

    def test_empty_claims_array_falls_through_to_top_level(self):
        row = _slip_case(claims=[], ref_no="2024-1105009358 001")
        keys, _ = extract_keys_from_slip_case(row)
        assert len(keys) == 1
        assert keys[0].revision == 1

    def test_no_ref_no_anywhere_returns_skip_reason(self):
        row = _slip_case(claims=None)
        # No claims, no ref_no. Should skip with a reason.
        keys, reasons = extract_keys_from_slip_case(row)
        assert keys == []
        assert any("no claims[] and no top-level ref_no" in r for r in reasons)


# ─── Defensive handling ────────────────────────────────────────────────────


class TestDefensiveHandling:
    def test_non_kb_slip_case_returns_empty(self):
        row = _slip_case(cedant="HW", ref_no="25091916949")
        keys, reasons = extract_keys_from_slip_case(row)
        assert keys == []
        assert any("non-KB cedant" in r for r in reasons)

    def test_extracted_missing_returns_skip_reason(self):
        row = {"id": "x", "extracted": None, "input_files": []}
        keys, reasons = extract_keys_from_slip_case(row)
        assert keys == []
        assert any("not a dict" in r for r in reasons)

    def test_claims_list_with_non_dict_elements_skipped(self):
        row = _slip_case(claims=["not-a-dict", {"cedant_ref_no": "2024-1105009358 001"}])
        keys, reasons = extract_keys_from_slip_case(row)
        assert len(keys) == 1
        assert any("not a dict" in r for r in reasons)

    def test_whitespace_around_ref_is_stripped(self):
        row = _slip_case(claims=[{"cedant_ref_no": "  2024-1105009358 001   "}])
        keys, _ = extract_keys_from_slip_case(row)
        assert keys[0].ref_body == "2024-1105009358"


# ─── Quality grading ───────────────────────────────────────────────────────


class TestQualityGrading:
    def test_partial_when_recipient_and_revision_present(self):
        row = _slip_case(claims=[{"cedant_ref_no": "2024-1105009358 001"}])
        keys, _ = extract_keys_from_slip_case(row)
        assert keys[0].quality == QUALITY_PARTIAL

    def test_inferred_when_revision_missing(self):
        # ref_no without trailing revision (no revision present).
        row = _slip_case(claims=[{"cedant_ref_no": "2024-1105009358"}])
        keys, _ = extract_keys_from_slip_case(row)
        assert keys[0].quality == QUALITY_INFERRED


# ─── SlipCasesAdapter integration ──────────────────────────────────────────


class TestAdapterPopulate:
    def test_returns_summary_report(self):
        rows = [
            _slip_case(
                case_id="a",
                claims=[
                    {"cedant_ref_no": "2024-1105009358 001"},
                    {"cedant_ref_no": "2024-1105009358 002"},
                ],
            ),
        ]
        adapter = SlipCasesAdapter()
        history = SOCHistory()
        report = adapter.populate(history, rows=rows)
        assert isinstance(report, SlipCasesSyncReport)
        assert report.total_slip_cases == 1
        assert report.extracted_keys == 2
        assert report.quality_breakdown[QUALITY_PARTIAL] == 2
        assert report.admitted_to_history == 2

    def test_idempotent_on_repeated_populate(self):
        """Running populate twice with the same rows must not double-
        count keys in the SOCHistory partial tier."""
        rows = [_slip_case(claims=[{"cedant_ref_no": "2024-1105009358 001"}])]
        adapter = SlipCasesAdapter()
        history = SOCHistory()
        adapter.populate(history, rows=rows)
        report = adapter.populate(history, rows=rows)
        # No new admissions on the second call.
        assert report.admitted_to_history == 0
        assert history.partial_count() == 1

    def test_below_threshold_keys_skipped(self):
        # Inferred ref (no revision) gets blocked when threshold='partial'.
        rows = [_slip_case(claims=[{"cedant_ref_no": "2024-1105009358"}])]
        adapter = SlipCasesAdapter(quality_threshold=QUALITY_PARTIAL)
        history = SOCHistory()
        report = adapter.populate(history, rows=rows)
        assert report.extracted_keys == 1
        assert report.quality_breakdown[QUALITY_INFERRED] == 1
        assert report.admitted_to_history == 0
        assert history.partial_count() == 0
        assert any("below threshold" in s["reason"] for s in report.skipped)

    def test_threshold_inferred_admits_everything(self):
        rows = [_slip_case(claims=[{"cedant_ref_no": "2024-1105009358"}])]
        adapter = SlipCasesAdapter(quality_threshold=QUALITY_INFERRED)
        history = SOCHistory()
        report = adapter.populate(history, rows=rows)
        assert report.admitted_to_history == 1

    def test_invalid_threshold_raises(self):
        with pytest.raises(ValueError, match="quality_threshold"):
            SlipCasesAdapter(quality_threshold="bogus")

    def test_db_fetch_with_no_session_returns_empty_gracefully(self):
        """Phase 3c implements ``_fetch_from_db`` but degrades to an
        empty list when there's no DB session bound. This guarantees
        the soc_stream flow never breaks because of slip_cases."""
        adapter = SlipCasesAdapter()  # no db_session
        history = SOCHistory()
        report = adapter.populate(history)
        assert report.total_slip_cases == 0
        assert report.admitted_to_history == 0
        assert adapter.fetch_error == "no db_session bound"

    def test_db_fetch_failure_degrades_gracefully(self):
        """Any exception from the session must be swallowed into an
        empty result + ``fetch_error`` audit field."""
        class _BoomSession:
            def execute(self, *a, **kw):
                raise RuntimeError("simulated DB outage")

        adapter = SlipCasesAdapter(db_session=_BoomSession())
        history = SOCHistory()
        report = adapter.populate(history)
        assert report.total_slip_cases == 0
        assert "simulated DB outage" in (adapter.fetch_error or "")


# ─── SOCHistory partial tier integration ───────────────────────────────────


class TestHistoryPartialTier:
    def test_partial_does_not_satisfy_strict_has_seen(self):
        """Partial keys live in a separate tier — Phase-2 strict
        matching must not be influenced by them."""
        history = SOCHistory()
        history.add_partial(
            recipient=DEFAULT_INS_RECIPIENT,
            ref_body="2024-1105009358",
            revision=1,
            quality=QUALITY_PARTIAL,
        )
        # Try a strict 5-tuple lookup with full base key.
        full_base = (
            DEFAULT_INS_RECIPIENT, "2024-1105009358", "박*배", 1, 1,
        )
        assert history.has_seen(full_base) is False
        # But the ref-level query finds it.
        assert history.has_seen_at_ref_level(
            DEFAULT_INS_RECIPIENT, "2024-1105009358",
        ) is True

    def test_partial_count_separate_from_main_count(self):
        history = SOCHistory()
        history.add_partial(
            recipient=DEFAULT_INS_RECIPIENT,
            ref_body="ref-1",
            revision=1,
            quality=QUALITY_PARTIAL,
        )
        assert len(history) == 0          # bordereau tier
        assert history.partial_count() == 1  # slip_cases tier

    def test_add_partial_rejects_invalid_quality(self):
        history = SOCHistory()
        with pytest.raises(ValueError, match="unknown quality grade"):
            history.add_partial(
                recipient="x", ref_body="ref-1", revision=1, quality="bogus",
            )

    def test_add_partial_rejects_empty_recipient(self):
        history = SOCHistory()
        with pytest.raises(ValueError, match="recipient and ref_body"):
            history.add_partial(
                recipient="", ref_body="ref-1", revision=1, quality=QUALITY_PARTIAL,
            )

    def test_partial_quality_lookup(self):
        history = SOCHistory()
        history.add_partial(
            recipient=DEFAULT_INS_RECIPIENT,
            ref_body="2024-1105009358",
            revision=1,
            quality=QUALITY_PARTIAL,
        )
        assert history.partial_quality(
            DEFAULT_INS_RECIPIENT, "2024-1105009358", 1,
        ) == QUALITY_PARTIAL
        # Wrong revision returns None — partial_quality is exact-key
        # lookup, not ref-level.
        assert history.partial_quality(
            DEFAULT_INS_RECIPIENT, "2024-1105009358", 99,
        ) is None
