"""Visual-LM analyser for per-field diff explanations.

For each non-`match` diff row the runner asks Gemini Pro to compare
the ground-truth PDF and the generated PDF side-by-side and explain
*why* the values diverge. Output is a small JSON object stored on
``testbench_pairs.vlm_analysis[field_key]``.

Wiring is intentionally tolerant of missing data — if either PDF is
missing, the prompt skips that field rather than failing the whole
run, because the testbench is also useful when only the generated
side exists yet.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

import google.generativeai as genai

from app.config import settings
from app.services.soc_utils import parse_json as _parse_json_raw
from app.services.testbench.diff import FieldDiff

logger = logging.getLogger(__name__)

# Per-field structured analysis. Keep keys short — the runner stores
# this object verbatim on `vlm_analysis[<key>]`.
_FIELD_PROMPT = """You are reviewing a reinsurance claim "Statement of Claim" / "Premium Loss Advisory"
slip extraction. Compare the two attached PDFs (GROUND_TRUTH first, GENERATED second)
and explain *why* one specific field differs.

FIELD: {label}
GROUND_TRUTH value: {gt_value!r}
GENERATED value: {gen_value!r}
DIFF severity (auto-classifier): {severity}

Return ONLY a JSON object with these keys:

  cause           one of: "ocr_miss" | "prompt_gap" | "rule_mismatch" |
                  "input_ambiguous" | "gt_error" | "ok_equivalent"
  winner          one of: "ground_truth" | "generated" | "neither" | "both"
  evidence        short string (≤ 200 chars) quoting or citing the
                  exact wording in either PDF that proves your answer
  suggested_fix   short string (≤ 200 chars) describing what would
                  need to change in the extraction rule / prompt to
                  align outputs with the winner. "" if no fix needed.
  confidence      float between 0 and 1
"""


async def analyse_pair(
    gt_path: Path | None,
    gen_path: Path | None,
    diffs: list[FieldDiff],
) -> dict[str, dict[str, Any]]:
    """Run VLM analysis for every non-match diff.

    Returns ``{ field_key: {cause, winner, evidence, suggested_fix,
    confidence} }``. Fields with ``severity == "match"`` are skipped
    (no signal to extract).
    """
    targets = [d for d in diffs if d.severity != "match"]
    if not targets:
        return {}
    if gt_path is None or gen_path is None:
        # Without both PDFs we can't ground the analysis visually. Tag
        # each non-match row with an explicit "missing_side" stub so
        # downstream UI knows VLM ran but couldn't form an opinion.
        return {
            d.key: {
                "cause": "input_ambiguous",
                "winner": "neither",
                "evidence": "",
                "suggested_fix": "한쪽 PDF 누락 — 데이터셋에 파일 보완 필요",
                "confidence": 0.0,
                "note": "missing_side",
            }
            for d in targets
        }

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-3.1-pro")

    gt_upload = await asyncio.to_thread(
        genai.upload_file, str(gt_path), mime_type="application/pdf"
    )
    gen_upload = await asyncio.to_thread(
        genai.upload_file, str(gen_path), mime_type="application/pdf"
    )

    async def _one(diff: FieldDiff) -> tuple[str, dict[str, Any]]:
        prompt = _FIELD_PROMPT.format(
            label=diff.label,
            gt_value=diff.original,
            gen_value=diff.generated,
            severity=diff.severity,
        )
        try:
            resp = await asyncio.to_thread(
                model.generate_content, [gt_upload, gen_upload, prompt]
            )
            parsed = _parse_json_raw(resp.text, unwrap_list=True) or {}
            if not isinstance(parsed, dict):
                raise ValueError("non-object response")
        except Exception as exc:  # pragma: no cover — best-effort
            logger.exception("VLM analysis failed for %s", diff.key)
            return diff.key, {
                "cause": "input_ambiguous",
                "winner": "neither",
                "evidence": "",
                "suggested_fix": "",
                "confidence": 0.0,
                "error": str(exc)[:160],
            }
        return diff.key, {
            "cause": parsed.get("cause") or "input_ambiguous",
            "winner": parsed.get("winner") or "neither",
            "evidence": (parsed.get("evidence") or "")[:240],
            "suggested_fix": (parsed.get("suggested_fix") or "")[:240],
            "confidence": float(parsed.get("confidence") or 0.0),
        }

    try:
        results = await asyncio.gather(*[_one(d) for d in targets])
    finally:
        for upload in (gt_upload, gen_upload):
            try:
                await asyncio.to_thread(genai.delete_file, upload.name)
            except Exception:
                logger.exception("Failed to delete VLM upload %s", upload.name)

    return {k: v for k, v in results}


def summarise_causes(analyses: dict[str, dict[str, Any]]) -> dict[str, int]:
    """Aggregate ``cause`` counts across one pair — used by the
    runner to populate ``summary.by_cause`` on the run record."""
    out: dict[str, int] = {}
    for entry in analyses.values():
        cause = entry.get("cause") or "unknown"
        out[cause] = out.get(cause, 0) + 1
    return out


def to_jsonable(analyses: dict[str, dict[str, Any]]) -> str:
    """JSON-encode the analyses dict for logging / persistence."""
    return json.dumps(analyses, ensure_ascii=False, sort_keys=True)
