"""Weekly Result & Plan dashboard — internal staff work-progress view.

EXPERIMENTAL / ISOLATED, same contract as the rq-slip tool:
- prefix ``/api/tools/weekly`` — no overlap with claims/contract routes.
- NO DB, NO migrations. Parsed weeks persist as plain JSON under
  ``backend/data/weekly/`` so uploads accumulate week-over-week without
  touching any live pipeline.

Upload one or more weekly workbooks (취합본 or personal). Each is parsed into
structured deals (see ``weekly_parser``) and stored keyed by its week range.
Consolidated (취합본) files win over personal ones for the same week.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import unicodedata
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.weekly_parser import HANDLER_NAMES, parse_workbook

router = APIRouter(prefix="/api/tools/weekly", tags=["weekly"])
logger = logging.getLogger(__name__)

# Store location. Default backend/data/weekly/ (writable in local dev). On prod
# /app/data is mounted read-only, so WEEKLY_STORE_DIR points at a writable
# volume instead — set in docker-compose.prod.yml.
_STORE = Path(
    os.environ.get("WEEKLY_STORE_DIR") or (Path(__file__).resolve().parents[2] / "data" / "weekly")
)

_SAFE = re.compile(r"[^0-9A-Za-z._-]+")


def _store_dir() -> Path:
    _STORE.mkdir(parents=True, exist_ok=True)
    return _STORE


def _week_id(payload: dict[str, Any]) -> str:
    """Stable key for a parsed week. Falls back to a filename slug when the
    workbook name carries no date range."""
    start, end = payload.get("week_start"), payload.get("week_end")
    if start and end:
        return f"{start}_{end}"
    slug = _SAFE.sub("-", unicodedata.normalize("NFC", payload.get("filename", "week")))
    return slug[:80] or "week"


def _read_all() -> list[dict[str, Any]]:
    weeks: list[dict[str, Any]] = []
    for fp in sorted(_store_dir().glob("*.json")):
        try:
            weeks.append(json.loads(fp.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            logger.warning("weekly: skipping unreadable store file %s", fp.name)
    weeks.sort(key=lambda w: (w.get("week_start") or "", w.get("filename") or ""))
    return weeks


def _meta(week: dict[str, Any]) -> dict[str, Any]:
    return {
        "week_id": week["week_id"],
        "week_start": week.get("week_start"),
        "week_end": week.get("week_end"),
        "source": week.get("source"),
        "filename": week.get("filename"),
        "deal_count": len(week.get("deals", [])),
    }


@router.get("/health")
async def health() -> dict[str, Any]:
    weeks = _read_all()
    return {"ok": True, "stored_weeks": len(weeks)}


@router.post("/upload")
async def upload(files: list[UploadFile] = File(default=[])) -> dict[str, Any]:
    """Parse and store one or more weekly workbooks.

    Consolidated (취합본) uploads always overwrite. A personal upload is only
    stored when no consolidated file already exists for that week, so the
    dashboard never regresses from the merged view to one person's slice.
    """
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")

    results: list[dict[str, Any]] = []
    store = _store_dir()

    for up in files:
        name = unicodedata.normalize("NFC", up.filename or "upload.xlsx")
        if not name.lower().endswith((".xlsx", ".xlsm")):
            results.append({"filename": name, "status": "skipped", "reason": "not an .xlsx file"})
            continue

        suffix = Path(name).suffix or ".xlsx"
        tmp_path = None
        try:
            data = await up.read()
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(data)
                tmp_path = tmp.name
            payload = parse_workbook(tmp_path, filename=name)
        except Exception as exc:  # noqa: BLE001 — surface a clean per-file error
            logger.exception("weekly: failed to parse %s", name)
            results.append({"filename": name, "status": "error", "reason": str(exc)[:200]})
            continue
        finally:
            if tmp_path:
                Path(tmp_path).unlink(missing_ok=True)

        if not payload["deals"]:
            results.append({"filename": name, "status": "skipped", "reason": "no deal rows found"})
            continue

        wid = _week_id(payload)
        payload["week_id"] = wid
        dest = store / f"{wid}.json"

        if dest.exists():
            try:
                existing = json.loads(dest.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                existing = {}
            if existing.get("source") == "consolidated" and payload["source"] != "consolidated":
                results.append(
                    {
                        "filename": name,
                        "status": "skipped",
                        "reason": "consolidated week already stored",
                        "week_id": wid,
                    }
                )
                continue

        dest.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        results.append(
            {
                "filename": name,
                "status": "stored",
                "week_id": wid,
                "deal_count": len(payload["deals"]),
                "source": payload["source"],
            }
        )

    return {"results": results, "weeks": [_meta(w) for w in _read_all()]}


@router.get("/data")
async def data() -> dict[str, Any]:
    """All stored weeks with their deals, plus the handler-name legend. The
    frontend computes every view client-side from this single payload."""
    weeks = _read_all()
    return {
        "weeks": [{**_meta(w), "deals": w.get("deals", [])} for w in weeks],
        "handler_names": HANDLER_NAMES,
    }


@router.get("/weeks")
async def weeks() -> dict[str, Any]:
    return {"weeks": [_meta(w) for w in _read_all()]}


@router.delete("/weeks/{week_id}")
async def delete_week(week_id: str) -> dict[str, Any]:
    safe = _SAFE.sub("-", week_id)
    dest = _store_dir() / f"{safe}.json"
    if not dest.exists():
        raise HTTPException(status_code=404, detail="week not found")
    dest.unlink()
    return {"deleted": safe, "weeks": [_meta(w) for w in _read_all()]}
