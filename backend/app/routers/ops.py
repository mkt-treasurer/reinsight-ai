"""Operations dashboard — contract-management ledger ingest & snapshots.

EXPERIMENTAL / ISOLATED, same contract as the rq-slip and weekly tools:
- prefix ``/api/tools/ops`` — no overlap with claims/contract routes.
- NO DB, NO migrations. Each uploaded ledger is parsed (see ``ops_parser``)
  and persisted as a dated JSON snapshot under ``backend/data/ops/`` so the
  dashboard can show week-over-week movement across uploads.

Upload the master contract-management workbook (AI계약관리.xlsx). The dashboard
computes every operational view client-side — PPW collection, AR/AP
settlement, renewal pipeline, and per-manager progress with WoW deltas.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.ops_parser import (
    open_settlement,
    parse_workbook,
    summarise_settlement,
)

router = APIRouter(prefix="/api/tools/ops", tags=["ops"])
logger = logging.getLogger(__name__)

# Default backend/data/ops/ (writable in local dev). On prod /app/data is
# read-only, so OPS_STORE_DIR points at a writable volume — see
# docker-compose.prod.yml.
_STORE = Path(
    os.environ.get("OPS_STORE_DIR") or (Path(__file__).resolve().parents[2] / "data" / "ops")
)


def _store_dir() -> Path:
    _STORE.mkdir(parents=True, exist_ok=True)
    return _STORE


def _meta(snap: dict[str, Any]) -> dict[str, Any]:
    return {
        "snapshot_id": snap["snapshot_id"],
        "uploaded_at": snap.get("uploaded_at"),
        "filename": snap.get("filename"),
        "sheets": snap.get("sheets", {}),
        "settlement_sheets": snap.get("settlement_sheets", {}),
        "row_count": len(snap.get("rows", [])),
        "settlement_count": len(snap.get("settlement", [])),
    }


def _read_all() -> list[dict[str, Any]]:
    snaps: list[dict[str, Any]] = []
    for fp in sorted(_store_dir().glob("*.json")):
        try:
            snaps.append(json.loads(fp.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            logger.warning("ops: skipping unreadable snapshot %s", fp.name)
    snaps.sort(key=lambda s: (s.get("snapshot_id") or "", s.get("uploaded_at") or ""))
    return snaps


@router.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "snapshots": len(_read_all())}


@router.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict[str, Any]:
    """Parse and store the contract-management workbook as a dated snapshot.

    The snapshot id is the upload date (YYYY-MM-DD); re-uploading on the same
    day overwrites that day's snapshot, so WoW always compares distinct days.
    """
    name = file.filename or "upload.xlsx"
    if not name.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="not an .xlsx file")

    tmp_path = None
    try:
        data = await file.read()
        with tempfile.NamedTemporaryFile(suffix=Path(name).suffix or ".xlsx", delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        parsed = parse_workbook(tmp_path, filename=name)
    except Exception as exc:  # noqa: BLE001 — surface a clean error
        logger.exception("ops: failed to parse %s", name)
        raise HTTPException(status_code=422, detail=f"parse failed: {str(exc)[:200]}") from exc
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)

    if not parsed["rows"]:
        raise HTTPException(status_code=422, detail="no contract rows found in any Actual* sheet")

    now = datetime.now()
    snapshot_id = now.date().isoformat()
    payload = {
        "snapshot_id": snapshot_id,
        "uploaded_at": now.isoformat(timespec="seconds"),
        "filename": parsed["filename"],
        "sheets": parsed["sheets"],
        "settlement_sheets": parsed.get("settlement_sheets", {}),
        "rows": parsed["rows"],
        "settlement": parsed.get("settlement", []),
    }
    (_store_dir() / f"{snapshot_id}.json").write_text(
        json.dumps(payload, ensure_ascii=False), encoding="utf-8"
    )
    return {"stored": _meta(payload), "snapshots": [_meta(s) for s in _read_all()]}


def _years(rows: list[dict[str, Any]]) -> list[int]:
    return sorted({r["book_year"] for r in rows if r.get("book_year")}, reverse=True)


@router.get("/data")
async def data(year: int | None = None) -> dict[str, Any]:
    """Latest snapshot's contract rows for ONE booking year (+ the previous
    snapshot's same-year rows for WoW deltas) + all snapshot metas.

    Contract rows span ~10 years / ~21k rows (~15 MB); shipping them whole just
    to display one year is wasteful, so ``rows``/``prev_rows`` are filtered to
    ``year`` (default: the most recent). ``years`` lists every available year so
    the frontend can build the selector without downloading the other years.

    The settlement (선수금) ledger is likewise never shipped whole: ``settlement``
    carries only the open/actionable rows (all years — old unsettled items are
    the most important) and ``settlement_summary`` rolls the rest up.
    """
    snaps = _read_all()
    latest = snaps[-1] if snaps else None
    previous = snaps[-2] if len(snaps) >= 2 else None

    all_rows = latest.get("rows", []) if latest else []
    years = _years(all_rows)
    chosen = year if year in years else (years[0] if years else None)

    def _for_year(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [r for r in rows if chosen is None or r.get("book_year") == chosen]

    settlement = latest.get("settlement", []) if latest else []
    return {
        "snapshots": [_meta(s) for s in snaps],
        "latest": _meta(latest) if latest else None,
        "years": years,
        "year": chosen,
        "rows": _for_year(all_rows),
        "prev_rows": _for_year(previous.get("rows", [])) if previous else [],
        "prev_snapshot_id": previous["snapshot_id"] if previous else None,
        "settlement": open_settlement(settlement),
        "settlement_summary": summarise_settlement(settlement),
    }


@router.get("/snapshots")
async def snapshots() -> dict[str, Any]:
    return {"snapshots": [_meta(s) for s in _read_all()]}


@router.delete("/snapshots/{snapshot_id}")
async def delete_snapshot(snapshot_id: str) -> dict[str, Any]:
    # snapshot_id is an ISO date; reject anything else so the glob can't escape.
    if not snapshot_id.replace("-", "").isdigit():
        raise HTTPException(status_code=400, detail="invalid snapshot id")
    dest = _store_dir() / f"{snapshot_id}.json"
    if not dest.exists():
        raise HTTPException(status_code=404, detail="snapshot not found")
    dest.unlink()
    return {"deleted": snapshot_id, "snapshots": [_meta(s) for s in _read_all()]}
