"""Code table API — exposes the canonical lines/insurers/reinsurers/currencies
data so the frontend can render dropdowns and apply foreign/domestic rules."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter

from app.data.code_table import (
    CURRENCIES,
    INSURERS,
    LINES,
    REINSURERS,
)

router = APIRouter(prefix="/api/tools/code-table", tags=["code_table"])


@router.get("")
async def get_code_table() -> dict:
    return {
        "lines": [asdict(l) for l in LINES],
        "insurers": [asdict(i) for i in INSURERS],
        "reinsurers": [asdict(r) for r in REINSURERS],
        "currencies": list(CURRENCIES),
    }
