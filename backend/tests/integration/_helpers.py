"""Shared helpers for the Phase-3c soc_stream integration tests.

The integration tests don't drive the full FastAPI / SSE pipeline —
that would need Gemini, async DB, file uploads, the works. Instead
they exercise the integration helpers in
:mod:`soc_stream_kb_integration` directly under the three
``KB_PARSER_MODE`` settings, which is enough to verify:

- OFF mode: every helper short-circuits and ``evidence_payload``
  stays byte-identical.
- SHADOW mode: parsing happens, cross-check runs, but the LLM prompt
  isn't touched (we never inject context).
- ON mode: parsing happens, cross-check runs, and the LLM prompt
  injection is actually returned.
- Non-KB inputs in any mode: detector returns ``None`` and the
  pipeline behaves like OFF for that file.
"""

from __future__ import annotations

import importlib
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "kb_borderau"
REAL_PLA_INS = FIXTURES / "PLA_FAC_INS_2026.02.xlsx"
REAL_PLA_DAEWOO = FIXTURES / "PLA_FAC_INS(DAEWOO)_2026.02.xlsx"
REAL_SOC_INS = FIXTURES / "SOC_FAC_INS_2026.02.xlsx"


@contextmanager
def kb_parser_mode(mode: str, *, approved: str | None = None) -> Iterator[None]:
    """Temporarily set ``KB_PARSER_MODE`` (and optional approval),
    reload :mod:`app.config` and the integration module so they pick
    up the new value, then restore everything on exit.
    """
    saved_mode = os.environ.get("KB_PARSER_MODE")
    saved_approved = os.environ.get("KB_PARSER_ON_APPROVED")

    os.environ["KB_PARSER_MODE"] = mode
    if approved is not None:
        os.environ["KB_PARSER_ON_APPROVED"] = approved
    elif "KB_PARSER_ON_APPROVED" in os.environ:
        del os.environ["KB_PARSER_ON_APPROVED"]

    import app.config
    importlib.reload(app.config)
    import app.services.soc_stream_kb_integration as kb_int
    importlib.reload(kb_int)

    try:
        yield
    finally:
        # Restore env.
        if saved_mode is None:
            os.environ.pop("KB_PARSER_MODE", None)
        else:
            os.environ["KB_PARSER_MODE"] = saved_mode
        if saved_approved is None:
            os.environ.pop("KB_PARSER_ON_APPROVED", None)
        else:
            os.environ["KB_PARSER_ON_APPROVED"] = saved_approved
        importlib.reload(app.config)
        importlib.reload(kb_int)


def kb_int_module():
    """Return the freshly-reloaded integration module."""
    import app.services.soc_stream_kb_integration as kb_int
    return kb_int


def fake_llm_response_for_kb_pla() -> dict:
    """Build a Pass-1-shaped LLM response that *roughly* matches the
    real KB INS PLA fixture so cross-check has a believable comparison
    target. The exact numbers don't have to match — the tests anchor
    on severity bands rather than exact equality.
    """
    return {
        "account_name": "(주) 온라인투어",
        "cedant_code": "KB",
        "currency": "WON",
        "ref_no": "20230707020197",
        "total_amount_100": 11000000,
        "claims": [
            {
                "cedant_ref_no": "20230707020197 000",
                "currency": "WON",
                "claim_amount_100": 1000000,
                "expense_100": 0,
            },
        ],
    }
