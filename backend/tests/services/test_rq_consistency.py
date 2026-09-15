"""Unit tests for the calc-basis consistency reference DB (rq-slip placement)."""

import pytest

from app.services.rq_consistency import (
    compare_amounts,
    detect_currency,
    enrich_discrepancies,
    normalize_amount,
)


@pytest.mark.unit
class TestNormalizeAmount:
    def test_korean_eok_unit_expands_to_won(self):
        # Arrange / Act
        result = normalize_amount("7,000억원")
        # Assert
        assert result is not None
        assert result["amount"] == 700_000_000_000.0
        assert result["currency"] == "KRW"
        assert result["unit"] == "억"

    def test_usd_with_decimals_and_thousands(self):
        result = normalize_amount("USD 475,365,023.10")
        assert result["amount"] == pytest.approx(475_365_023.10)
        assert result["currency"] == "USD"
        assert result["unit"] is None

    def test_plain_krw_no_unit(self):
        result = normalize_amount("69,227,707,982 KRW")
        assert result["amount"] == 69_227_707_982.0
        assert result["currency"] == "KRW"

    def test_baekman_million_unit(self):
        result = normalize_amount("700,000백만원")
        assert result["amount"] == 700_000 * 1_000_000
        assert result["unit"] == "백만"

    def test_bare_baek_is_not_treated_as_unit(self):
        # "백" alone is ambiguous (76백 = 76 백만원 in KR insurance shorthand);
        # the reference deliberately does not expand it.
        result = normalize_amount("76백")
        assert result["unit"] is None
        assert result["amount"] == 76.0

    @pytest.mark.parametrize("text", ["", "   ", None, "TBA", "추후 협의"])
    def test_unparseable_returns_none_or_no_amount(self, text):
        result = normalize_amount(text)
        assert result is None or result["amount"] is None


@pytest.mark.unit
class TestDetectCurrency:
    @pytest.mark.parametrize(
        "text,expected",
        [
            ("USD 1,000", "USD"),
            ("$5,000", "USD"),
            ("KRW 5,000,000", "KRW"),
            ("5,000,000원", "KRW"),
            ("7,000억", "KRW"),
            ("1,000", None),
        ],
    )
    def test_currency_detection(self, text, expected):
        assert detect_currency(text) == expected


@pytest.mark.unit
class TestCompareAmounts:
    def test_cross_currency_reconciles_at_plausible_fx(self):
        # 7,000억원 vs USD 475,365,023.10 → ~1,473 KRW/USD → reconcilable
        krw = normalize_amount("7,000억원")
        usd = normalize_amount("USD 475,365,023.10")
        result = compare_amounts(usd, krw)
        assert result["verdict"] == "reconcilable"
        assert 1400 < result["rate"] < 1550
        assert "환율" in result["note"]

    def test_cross_currency_real_mismatch_outside_fx_band(self):
        # USD 475M vs 70억원 (7,000,000,000 KRW) → ~14.7 KRW/USD → unrealistic
        usd = normalize_amount("USD 475,365,023")
        krw = normalize_amount("70억원")
        result = compare_amounts(usd, krw)
        assert result["verdict"] == "mismatch"

    def test_same_currency_within_tolerance_is_match(self):
        a = normalize_amount("1,000,000,000 KRW")
        b = normalize_amount("1,000,000,005 KRW")
        assert compare_amounts(a, b)["verdict"] == "match"

    def test_same_currency_large_gap_is_mismatch(self):
        a = normalize_amount("USD 1,000,000")
        b = normalize_amount("USD 3,000,000")
        result = compare_amounts(a, b)
        assert result["verdict"] == "mismatch"
        assert result["ratio"] == pytest.approx(3.0)

    def test_missing_value_is_unknown(self):
        assert compare_amounts(normalize_amount("USD 1,000"), None)["verdict"] == "unknown"


@pytest.mark.unit
class TestEnrichDiscrepancies:
    def test_money_discrepancy_gets_reference_note_and_severity(self):
        extracted = {
            "discrepancies": [
                {
                    "field": "annual_turnover",
                    "rq_value": "USD 475,365,023.10",
                    "other_value": "7,000억원 (설문서)",
                    "severity": "medium",
                    "note": "매출액 표기 상이",
                }
            ]
        }
        out = enrich_discrepancies(extracted)
        d = out["discrepancies"][0]
        assert "[참고DB]" in d["note"]
        assert "매출액 표기 상이" in d["note"]  # original note preserved
        assert d["severity"] == "medium"  # reconcilable

    def test_real_magnitude_mismatch_escalates_to_high(self):
        extracted = {
            "discrepancies": [
                {
                    "field": "limit_of_liability",
                    "rq_value": "USD 1,000,000",
                    "other_value": "USD 5,000,000",
                    "severity": "low",
                    "note": "",
                }
            ]
        }
        out = enrich_discrepancies(extracted)
        assert out["discrepancies"][0]["severity"] == "high"

    def test_non_money_field_passes_through_untouched(self):
        extracted = {
            "discrepancies": [
                {"field": "insured", "rq_value": "A Corp", "other_value": "B Corp",
                 "severity": "high", "note": "피보험자 상이"}
            ]
        }
        out = enrich_discrepancies(extracted)
        assert out["discrepancies"][0] == extracted["discrepancies"][0]

    def test_empty_discrepancies_is_noop(self):
        assert enrich_discrepancies({"discrepancies": []}) == {"discrepancies": []}

    def test_input_is_not_mutated(self):
        extracted = {
            "discrepancies": [
                {"field": "annual_turnover", "rq_value": "USD 475,365,023.10",
                 "other_value": "7,000억원", "severity": "medium", "note": "x"}
            ]
        }
        original_note = extracted["discrepancies"][0]["note"]
        enrich_discrepancies(extracted)
        assert extracted["discrepancies"][0]["note"] == original_note  # untouched
