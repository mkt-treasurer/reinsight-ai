"""Run the shared SOC extraction prompt against a single PDF/image.

Functionally identical to the body of
``slip_testbench.extract_slip_fields`` — pulled into a service module so
the runs pipeline can call it in parallel without taking on the HTTP
layer. Both code paths return the same normalised ``extracted`` dict
shape that the testbench compare page renders.
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

import google.generativeai as genai

from app.config import settings
from app.data.code_table import canonicalize_company_name
from app.services.soc_prompts import EXTRACT_CLAIM_BORDEREAU
from app.services.soc_utils import parse_json as _parse_json_raw, to_num as _to_num

logger = logging.getLogger(__name__)

_MIME_BY_SUFFIX: dict[str, str] = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def _normalise(ai: dict[str, Any], filename: str) -> dict[str, Any]:
    return {
        "filename": filename,
        "account_name": ai.get("account_name") or "",
        "reinsured": canonicalize_company_name(ai.get("reinsured") or ""),
        "cedant": ai.get("cedant_code") or "",
        "line": ai.get("line") or "",
        "ref_no": ai.get("ref_no") or "",
        "dol": ai.get("dol") or "",
        "doc_date": ai.get("doc_date") or "",
        "title_subline": ai.get("title_subline") or "",
        "currency": ai.get("currency") or "",
        "total_amount": _to_num(ai.get("total_amount_100")),
        "expenses_reserve": _to_num(ai.get("expenses_reserve_100")),
        "location_of_loss": ai.get("location_of_loss") or "",
        "nature_of_loss": ai.get("nature_of_loss") or "",
        "particulars": ai.get("particulars") or "",
        "policy_period": ai.get("policy_period") or "",
        "remarks": ai.get("remarks") or "",
        "description": ai.get("description") or "",
    }


async def extract_fields_from_path(path: Path) -> dict[str, Any]:
    """Upload ``path`` to Gemini, run the slip-extraction prompt, and
    return the normalised extracted-fields dict.

    Raises ``ValueError`` for unsupported mime / empty files; lets
    Gemini SDK exceptions propagate.
    """
    suffix = path.suffix.lower()
    mime = _MIME_BY_SUFFIX.get(suffix)
    if not mime:
        raise ValueError(f"Unsupported file type {suffix!r} — pdf/png/jpg only.")
    if not path.is_file():
        raise FileNotFoundError(str(path))
    if path.stat().st_size == 0:
        raise ValueError(f"Empty file: {path.name}")

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-3.1-flash-lite")

    gfile = await asyncio.to_thread(
        genai.upload_file, str(path), mime_type=mime
    )
    try:
        resp = await asyncio.to_thread(
            model.generate_content, [gfile, EXTRACT_CLAIM_BORDEREAU]
        )
        parsed = _parse_json_raw(resp.text, unwrap_list=True) or {}
    finally:
        try:
            await asyncio.to_thread(genai.delete_file, gfile.name)
        except Exception:
            logger.exception("Failed to delete Gemini upload %s", gfile.name)

    if not isinstance(parsed, dict):
        raise RuntimeError("AI returned non-object response.")
    return _normalise(parsed, path.name)
