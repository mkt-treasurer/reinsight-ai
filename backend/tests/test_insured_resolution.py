"""Unit tests for the Insured-name resolution helpers in `services.soc_utils`.

These cover two distinct gaps in the SOC slip pipeline:

  1. Source PDFs (notably KB) deliver the Insured field masked, e.g.
     "신****인". The slip must never display the masked form — it has to be
     resolved from past_claims / contracts / policy / claimant.
  2. When the slip is going to a foreign reinsurer the Insured must be
     rendered in English. Many `Contract.assured` rows already carry the
     English form bilingually ("...Co., Ltd. (한국...)"), so no LLM call is
     needed in those cases.
"""

from __future__ import annotations

import pytest

from app.services.soc_utils import (
    english_form_of_insured,
    pick_english_insured_name,
    resolve_insured_name,
)


class TestResolveInsuredName:
    def test_clean_input_returns_unchanged(self):
        name, src = resolve_insured_name("Acme Corp")
        assert name == "Acme Corp"
        assert src == "raw"

    def test_masked_falls_back_to_past_claims_first(self):
        name, src = resolve_insured_name(
            "신****인",
            past_claims=[{"account_name": "신성호인"}],
            contracts=[{"assured": "Other Co."}],
            policy={"assured": "Yet Another"},
            claimant="claimant_name",
        )
        assert name == "신성호인"
        assert src == "past_claims"

    def test_masked_uses_contracts_when_past_claims_empty(self):
        name, src = resolve_insured_name(
            "신****인",
            past_claims=[],
            contracts=[{"assured": "신성호인 Co., Ltd."}],
            policy={"assured": "Should Not Be Used"},
        )
        assert name == "신성호인 Co., Ltd."
        assert src == "contracts"

    def test_masked_uses_policy_when_claims_and_contracts_empty(self):
        name, src = resolve_insured_name(
            "신****인",
            policy={"assured": "신성호인 from Policy"},
        )
        assert name == "신성호인 from Policy"
        assert src == "policy"

    def test_masked_uses_claimant_as_last_resort(self):
        name, src = resolve_insured_name(
            "신****인",
            claimant="신성호인 Claimant",
        )
        assert name == "신성호인 Claimant"
        assert src == "claimant"

    def test_masked_with_no_candidates_returns_unresolved(self):
        name, src = resolve_insured_name("신****인")
        assert name == "신****인"
        assert src == "unresolved"

    def test_skips_other_masked_candidates(self):
        # Defensive: if past_claims somehow contains a masked entry too,
        # we should walk past it and try the next source.
        name, src = resolve_insured_name(
            "신****인",
            past_claims=[{"account_name": "다른****인"}],
            contracts=[{"assured": "신성호인 Co., Ltd."}],
        )
        assert name == "신성호인 Co., Ltd."
        assert src == "contracts"

    def test_empty_candidate_strings_are_skipped(self):
        name, src = resolve_insured_name(
            "신****인",
            past_claims=[{"account_name": ""}, {"account_name": "  "}],
            contracts=[{"assured": "신성호인"}],
        )
        assert name == "신성호인"
        assert src == "contracts"


class TestEnglishFormOfInsured:
    def test_pure_english_returned_unchanged(self):
        assert english_form_of_insured("WOOJIN Fashion Biz Co., Ltd.") == "WOOJIN Fashion Biz Co., Ltd."

    def test_strips_trailing_korean_paren(self):
        assert (
            english_form_of_insured("Korea South-East Power Co., Ltd. (한국남동발전)")
            == "Korea South-East Power Co., Ltd."
        )

    def test_strips_trailing_korean_paren_no_space(self):
        assert english_form_of_insured("HANBAEK INDUSTRY(한백산업)") == "HANBAEK INDUSTRY"

    def test_extracts_english_from_leading_korean(self):
        assert (
            english_form_of_insured("한국남동발전 (Korea South-East Power Co., Ltd.)")
            == "Korea South-East Power Co., Ltd."
        )

    def test_korean_only_returns_empty(self):
        assert english_form_of_insured("한국남동발전") == ""

    def test_empty_input_returns_empty(self):
        assert english_form_of_insured("") == ""
        assert english_form_of_insured(None) == ""  # type: ignore[arg-type]

    def test_english_with_legitimate_korea_word_kept(self):
        # "Korea" / "South-East" / "Power" are English even though Korea is a
        # country — no Hangul characters present.
        assert (
            english_form_of_insured("Black Rock Investment Management(Korea)Limited")
            == "Black Rock Investment Management(Korea)Limited"
        )


class TestPickEnglishInsuredName:
    def test_returns_raw_if_already_english(self):
        name, src = pick_english_insured_name("WOOJIN Fashion Biz Co., Ltd.")
        assert name == "WOOJIN Fashion Biz Co., Ltd."
        assert src == "raw"

    def test_strips_korean_paren_from_raw(self):
        name, src = pick_english_insured_name(
            "Korea South-East Power Co., Ltd. (한국남동발전)"
        )
        assert name == "Korea South-East Power Co., Ltd."
        assert src == "raw"

    def test_korean_only_raw_falls_back_to_contracts(self):
        name, src = pick_english_insured_name(
            "한국남동발전",
            contracts=[
                {"assured": "다른회사"},  # Korean-only — skipped
                {"assured": "Korea South-East Power Co., Ltd. (한국남동발전)"},
            ],
        )
        assert name == "Korea South-East Power Co., Ltd."
        assert src == "contracts"

    def test_falls_back_to_policy_after_contracts(self):
        name, src = pick_english_insured_name(
            "한국남동발전",
            contracts=[{"assured": "다른회사"}],
            policy={"assured": "한국남동발전 (Korea South-East Power Co., Ltd.)"},
        )
        assert name == "Korea South-East Power Co., Ltd."
        assert src == "policy"

    def test_no_english_anywhere_returns_empty(self):
        name, src = pick_english_insured_name(
            "한국남동발전",
            contracts=[{"assured": "다른회사"}],
            policy={"assured": "또 다른 회사"},
        )
        assert name == ""
        assert src == "none"

    def test_handles_none_inputs_gracefully(self):
        name, src = pick_english_insured_name("Acme Corp", contracts=None, policy=None)
        assert name == "Acme Corp"
        assert src == "raw"
