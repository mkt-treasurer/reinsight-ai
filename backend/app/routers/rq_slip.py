"""Placement RQ-slip generator (insightre.ai Facultative placement track).

EXPERIMENTAL / ISOLATED feature. Upload a cedent's RQ documents (RQ Slip,
설문서, contract, email) → Gemini extracts the structured placement fields and
flags 산출기초 mismatches → the frontend renders an editable INS Corp-format
RQ slip draft.

Deliberately self-contained:
- prefix ``/api/tools/rq-slip`` — no overlap with the claims SOC routes.
- STATELESS — no DB writes, no models, no migrations. Nothing here can affect
  the live claims/contract pipelines.
- imports only the new ``rq_prompts`` module + the shared Gemini config.
"""

import asyncio
import json
import os
import re
import uuid
import tempfile
import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import google.generativeai as genai

from app.config import settings
from app.database import get_db
from app.models.rq_slip_case import RqSlipCase
from app.services.rq_audit import log_event, log_extract, new_request_id
from app.services.rq_prompts import RQ_EXTRACT_PROMPT
from app.services.rq_reinsurers import parse_directory, match_reinsurers
from app.services.rq_consistency import enrich_discrepancies

router = APIRouter(prefix="/api/tools/rq-slip", tags=["rq_slip"])
logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-3.1-flash-lite"
MAX_INGEST_DEPTH = 2


def _parse_json(text: str | None) -> dict | None:
    """Extract the first JSON object from an LLM response, tolerating code
    fences and surrounding prose. Returns None if nothing parses."""
    if not text:
        return None
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _docx_text(path: str) -> str:
    """Plain-text dump of a .docx including table cells (설문서 is table-heavy)."""
    from docx import Document

    doc = Document(path)
    lines = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text and c.text.strip()]
            if cells:
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def _ingest(path: str, label: str, file_parts: list, text_parts: list) -> None:
    """Turn one uploaded file into Gemini-consumable parts.

    PDFs upload natively; .docx/.msg/.xls(x) are flattened to text (Gemini
    rejects those container formats as direct uploads). Failures degrade
    gracefully — a file we can't read simply contributes nothing.
    """
    suffix = Path(path).suffix.lower()
    try:
        if suffix == ".pdf":
            file_parts.append(genai.upload_file(path))
            return
        if suffix in (".docx", ".doc"):
            text_parts.append(f"[{label}]\n{_docx_text(path)}")
            return
        if suffix == ".msg":
            import extract_msg

            m = extract_msg.Message(path)
            text_parts.append(
                f"[{label}]\nSubject: {m.subject or ''}\n\n{(m.body or '')[:6000]}"
            )
            m.close()
            return
        if suffix == ".xlsx":
            import openpyxl

            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            out = [f"[{label}]"]
            for ws in wb.worksheets[:3]:
                out.append(f"# {ws.title}")
                for row in ws.iter_rows(max_row=60, values_only=True):
                    vals = [str(v) for v in row if v is not None]
                    if vals:
                        out.append(" | ".join(vals))
            wb.close()
            text_parts.append("\n".join(out))
            return
        if suffix == ".xls":
            import xlrd

            bk = xlrd.open_workbook(path)
            out = [f"[{label}]"]
            for sh in bk.sheets()[:3]:
                out.append(f"# {sh.name}")
                for r in range(min(sh.nrows, 60)):
                    vals = [str(c.value) for c in sh.row(r) if str(c.value).strip()]
                    if vals:
                        out.append(" | ".join(vals))
            text_parts.append("\n".join(out))
            return
        # Unknown type → upload and let Gemini try.
        file_parts.append(genai.upload_file(path))
    except Exception as exc:  # noqa: BLE001 — best-effort ingestion
        logger.warning("rq-slip ingest failed for %s: %s", label, exc)


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    """Demo prep probe — verify the bits this tool depends on.

    Returns a JSON map with one entry per dependency. ``status`` is ``ok``
    when every check passes, otherwise ``degraded`` with the failing
    checks listed in ``failing``. Safe to curl from a deploy script.

    Does **not** call Gemini (would cost a token spend per probe); the
    presence of the API key is checked instead.
    """
    checks: dict[str, str] = {}
    failing: list[str] = []

    if settings.gemini_api_key:
        checks["gemini_api_key"] = "ok"
    else:
        checks["gemini_api_key"] = "missing"
        failing.append("gemini_api_key")

    try:
        from sqlalchemy import text as _text

        await db.execute(_text("SELECT 1"))
        await db.execute(_text("SELECT 1 FROM rq_slip_cases LIMIT 1"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["database"] = f"error: {exc}"
        failing.append("database")

    try:
        from app.services.rq_audit import _ensure_dir

        log_dir = _ensure_dir()
        checks["audit_logs"] = "ok" if log_dir else "no log dir"
        if not log_dir:
            failing.append("audit_logs")
    except Exception as exc:  # noqa: BLE001
        checks["audit_logs"] = f"error: {exc}"
        failing.append("audit_logs")

    return {
        "status": "ok" if not failing else "degraded",
        "checks": checks,
        "failing": failing,
        "model": GEMINI_MODEL,
    }


@router.post("/extract")
async def extract_rq(
    files: list[UploadFile] = File(default=[]),
    text: str | None = Form(None),
):
    """Extract structured placement fields from the uploaded cedent documents.

    Returns ``{"extracted": {...}}`` on success or ``{"error": "..."}`` so the
    frontend can surface failures the same way the claims tool does.
    """
    if not files and not (text and text.strip()):
        return {"error": "RQ 파일 또는 텍스트를 업로드해 주세요."}

    if not settings.gemini_api_key:
        return {"error": "GEMINI_API_KEY가 설정되지 않았습니다."}

    # Read upload bytes on the event loop; do ALL the blocking work (tempfile
    # write + extract_msg/PDF ingest + Gemini call) off the event loop via a
    # worker thread. A multi-second synchronous parse must never stall the
    # async server — under uvicorn --reload it can otherwise get the in-flight
    # request killed mid-parse when the reloader fires.
    uploads = [
        (Path(u.filename or "").suffix.lower(), u.filename or "file", await u.read())
        for u in files
    ]
    request_id = new_request_id()
    filenames = [fname for _, fname, _ in uploads]
    text_chars = len(text.strip()) if text else 0

    def _run() -> dict:
        file_parts: list = []
        text_parts: list[str] = []
        tmp_paths: list[str] = []
        raw_response: str | None = None
        try:
            for suffix, fname, data in uploads:
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    tmp.write(data)
                    tmp.flush()
                    tmp_paths.append(tmp.name)
                _ingest(tmp_paths[-1], fname, file_parts, text_parts)

            if text and text.strip():
                text_parts.append(f"[Email / pasted text]\n{text.strip()[:6000]}")

            if not file_parts and not text_parts:
                log_extract(
                    request_id=request_id,
                    filenames=filenames,
                    text_chars=text_chars,
                    raw_response=None,
                    parsed=None,
                    error="no readable content",
                )
                return {"error": "업로드한 파일에서 읽을 수 있는 내용이 없습니다."}

            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(GEMINI_MODEL)
            prompt_parts: list = [*file_parts]
            if text_parts:
                prompt_parts.append("\n\n".join(text_parts))
            prompt_parts.append(RQ_EXTRACT_PROMPT)
            resp = model.generate_content(prompt_parts)
            raw_response = resp.text
            extracted = _parse_json(raw_response)
        except Exception as exc:  # noqa: BLE001
            logger.exception("rq-slip extraction failed")
            log_extract(
                request_id=request_id,
                filenames=filenames,
                text_chars=text_chars,
                raw_response=raw_response,
                parsed=None,
                error=str(exc),
            )
            return {"error": f"AI 추출 중 오류가 발생했습니다: {exc}"}
        finally:
            for p in tmp_paths:
                try:
                    os.unlink(p)
                except OSError:
                    pass

        if not extracted:
            log_extract(
                request_id=request_id,
                filenames=filenames,
                text_chars=text_chars,
                raw_response=raw_response,
                parsed=None,
                error="parse failure",
            )
            return {"error": "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요."}

        extracted.setdefault("conditions", [])
        extracted.setdefault("discrepancies", [])
        extracted.setdefault("additional_fields", [])
        extracted.setdefault("remarks", "")
        extracted.setdefault("ri_capacity", "")
        # Calc-basis reference pass: normalize money discrepancies (unit/currency)
        # and re-grade severity. Pure/stateless; safe no-op when none reported.
        extracted = enrich_discrepancies(extracted)
        log_extract(
            request_id=request_id,
            filenames=filenames,
            text_chars=text_chars,
            raw_response=raw_response,
            parsed=extracted,
        )
        return {"extracted": extracted, "request_id": request_id}

    return await asyncio.to_thread(_run)


@router.post("/reinsurers")
async def match_reinsurers_for_line(
    file: UploadFile = File(...),
    line: str = Form(...),
):
    """Given the broker's reinsurer contact directory (uploaded .xlsx/.xls) and
    a slip ``line``, return the reinsurers to approach for that risk.

    STATELESS — the directory holds PII and is parsed in a temp file that is
    never persisted. Returns ``{"line", "matched_sheet", "sub_line",
    "contacts": [...], "available_sheets": {...}}`` or ``{"error": "..."}``.
    """
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in (".xlsx", ".xls"):
        return {"error": "재보험사 컨택 디렉터리는 .xlsx 또는 .xls 파일이어야 합니다."}

    data = await file.read()
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp.flush()
            parsed = parse_directory(tmp.name)
    except Exception as exc:  # noqa: BLE001
        logger.exception("rq-slip reinsurer parse failed")
        return {"error": f"컨택 디렉터리 파싱 중 오류가 발생했습니다: {exc}"}

    if not any(parsed.values()):
        return {"error": "컨택 디렉터리에서 읽을 수 있는 연락처가 없습니다."}

    return match_reinsurers(parsed, line)


# ── Persistence: saved RQ-slip cases ──────────────────────────────────────
# Isolated `rq_slip_cases` table (no FK / no relation to claims data). Lets a
# drafted slip be saved, reloaded, edited, and given a review verdict — the
# accuracy-tracking loop the claims slip_cases table provides for SOC slips.


class CaseSave(BaseModel):
    insured: str | None = None
    line: str | None = None
    reinsured: str | None = None
    extracted: dict = {}
    slip: dict = {}
    note: str | None = None


class CasePatch(BaseModel):
    slip: dict | None = None
    status: str | None = None
    verdict: str | None = None
    note: str | None = None


def _summary(c: RqSlipCase) -> dict:
    return {
        "id": str(c.id),
        "insured": c.insured,
        "line": c.line,
        "reinsured": c.reinsured,
        "status": c.status,
        "verdict": c.verdict,
        "edit_count": c.edit_count or 0,
        "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _detail(c: RqSlipCase) -> dict:
    return {
        **_summary(c),
        "extracted": c.extracted or {},
        "slip": c.slip or {},
        "note": c.note,
        "edit_count": c.edit_count,
    }


async def _load(db: AsyncSession, case_id: str) -> RqSlipCase:
    try:
        uid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid case id")
    case = (
        await db.execute(select(RqSlipCase).where(RqSlipCase.id == uid))
    ).scalar_one_or_none()
    if not case or case.is_deleted:
        raise HTTPException(status_code=404, detail="case not found")
    return case


@router.post("/cases")
async def create_case(payload: CaseSave, db: AsyncSession = Depends(get_db)):
    case = RqSlipCase(
        insured=payload.insured,
        line=payload.line,
        reinsured=payload.reinsured,
        extracted=payload.extracted,
        slip=payload.slip,
        note=payload.note,
        status="draft",
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    log_event(
        "case.create",
        case_id=str(case.id),
        insured=case.insured,
        line=case.line,
        reinsured=case.reinsured,
    )
    return _detail(case)


@router.get("/cases")
async def list_cases(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(RqSlipCase)
            .where(RqSlipCase.is_deleted.is_(False))
            .order_by(RqSlipCase.updated_at.desc())
        )
    ).scalars().all()
    return {"cases": [_summary(c) for c in rows]}


@router.get("/cases/{case_id}")
async def get_case(case_id: str, db: AsyncSession = Depends(get_db)):
    case = await _load(db, case_id)
    log_event("case.load", case_id=case_id, status=case.status, verdict=case.verdict)
    return _detail(case)


@router.patch("/cases/{case_id}")
async def update_case(case_id: str, payload: CasePatch, db: AsyncSession = Depends(get_db)):
    case = await _load(db, case_id)
    actions: list[str] = []
    if payload.slip is not None:
        case.slip = payload.slip
        case.last_edited_at = datetime.utcnow()
        case.edit_count = (case.edit_count or 0) + 1
        # keep denormalized headline fields in sync with edits
        case.insured = payload.slip.get("insured") or case.insured
        case.line = payload.slip.get("line") or case.line
        case.reinsured = payload.slip.get("reinsured") or case.reinsured
        actions.append("slip")
    if payload.status is not None:
        if case.status != payload.status:
            actions.append(f"status:{payload.status}")
        case.status = payload.status
    if payload.verdict is not None:
        if case.verdict != payload.verdict:
            actions.append(f"verdict:{payload.verdict}")
        case.verdict = payload.verdict
        case.reviewed_at = datetime.utcnow()
    if payload.note is not None:
        actions.append("note")
        case.note = payload.note
    await db.commit()
    await db.refresh(case)
    if actions:
        log_event(
            "case.update",
            case_id=case_id,
            actions=actions,
            status=case.status,
            verdict=case.verdict,
            edit_count=case.edit_count,
        )
    return _detail(case)


@router.delete("/cases/{case_id}")
async def delete_case(case_id: str, db: AsyncSession = Depends(get_db)):
    case = await _load(db, case_id)
    case.is_deleted = True
    await db.commit()
    log_event("case.delete", case_id=case_id)
    return {"ok": True}
