"""Admin slip-testbench endpoints.

Two distinct surfaces are served from this router:

* ``POST /extract`` — single-PDF extraction used by the manual compare
  page. Drop two PDFs in the UI, hit the endpoint, look at the diff.
* ``POST/GET /runs`` — persisted runs over the ``testbench-dataset/``
  folder tree. Each run scans the local directories, extracts every
  PDF, computes diffs, calls Gemini Pro for VLM analysis of the
  non-match rows, and stores everything for trend charting.
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Any
from uuid import UUID

import google.generativeai as genai
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.data.code_table import canonicalize_company_name
from app.database import get_db
from app.models.testbench_run import TestbenchPair, TestbenchRun
from app.services.soc_prompts import EXTRACT_CLAIM_BORDEREAU
from app.services.soc_utils import parse_json as _parse_json_raw, to_num as _to_num
from app.services.testbench.dataset_scanner import DOC_TYPES
from app.services.testbench.runner import execute_run

router = APIRouter(prefix="/api/admin/slip-testbench", tags=["slip_testbench"])
logger = logging.getLogger(__name__)


_MIME_BY_SUFFIX = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

# Repo-rooted default. Override per-request via the body if you keep
# samples elsewhere on disk.
_DEFAULT_DATASET = Path(__file__).resolve().parents[3] / "testbench-dataset"


def _parse_json(raw: str):
    return _parse_json_raw(raw, unwrap_list=True)


@router.post("/extract")
async def extract_slip_fields(file: UploadFile = File(...)) -> dict:
    """Run a single uploaded PDF/image through the slip-extraction prompt
    and return the resulting structured JSON. The shape mirrors what
    `/api/tools/soc/stream` puts into `extracted` so the frontend can
    diff testbench results against live slip-generator output.
    """
    suffix = Path(file.filename or "").suffix.lower()
    mime = _MIME_BY_SUFFIX.get(suffix)
    if not mime:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type {suffix!r} — pdf/png/jpg only.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload.")

    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(data)
        tmp.flush()
        tmp.close()

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-3.1-flash-lite")

        gfile = await asyncio.to_thread(
            genai.upload_file, tmp.name, mime_type=mime
        )
        try:
            resp = await asyncio.to_thread(
                model.generate_content, [gfile, EXTRACT_CLAIM_BORDEREAU]
            )
            ai_result = _parse_json(resp.text) or {}
        finally:
            try:
                await asyncio.to_thread(genai.delete_file, gfile.name)
            except Exception:
                pass
    finally:
        try:
            Path(tmp.name).unlink(missing_ok=True)
        except Exception:
            pass

    if not isinstance(ai_result, dict):
        raise HTTPException(status_code=500, detail="AI returned non-object response.")

    # Normalize the shape so the frontend can do a clean diff. Mirrors the
    # `extracted` block built by soc_stream.
    extracted = {
        "filename": file.filename or "",
        "account_name": ai_result.get("account_name") or "",
        "reinsured": canonicalize_company_name(ai_result.get("reinsured") or ""),
        "cedant": ai_result.get("cedant_code") or "",
        "line": ai_result.get("line") or "",
        "ref_no": ai_result.get("ref_no") or "",
        "dol": ai_result.get("dol") or "",
        "doc_date": ai_result.get("doc_date") or "",
        "title_subline": ai_result.get("title_subline") or "",
        "currency": ai_result.get("currency") or "",
        "total_amount": _to_num(ai_result.get("total_amount_100")),
        "expenses_reserve": _to_num(ai_result.get("expenses_reserve_100")),
        "location_of_loss": ai_result.get("location_of_loss") or "",
        "nature_of_loss": ai_result.get("nature_of_loss") or "",
        "particulars": ai_result.get("particulars") or "",
        "policy_period": ai_result.get("policy_period") or "",
        "remarks": ai_result.get("remarks") or "",
        "description": ai_result.get("description") or "",
    }
    return {"extracted": extracted}


# ---------- Persisted runs ----------


class RunCreate(BaseModel):
    dataset_path: str | None = Field(
        default=None,
        description="Absolute or repo-relative path. Defaults to ./testbench-dataset.",
    )
    label: str | None = Field(default=None, max_length=120)
    doc_types: list[str] | None = Field(default=None)


class PairSummary(BaseModel):
    id: str
    doc_type: str
    pair_key: str
    ref_no: str | None
    reinsurer: str | None
    status: str
    accuracy: float | None
    input_filename: str | None
    gt_filename: str | None
    gen_filename: str | None


class RunSummaryOut(BaseModel):
    id: str
    label: str | None
    dataset_path: str
    status: str
    doc_types: list[str] | None
    summary: dict[str, Any] | None
    error_message: str | None
    created_at: str
    finished_at: str | None


class RunDetailOut(RunSummaryOut):
    pairs: list[PairSummary]


class PairDetailOut(BaseModel):
    id: str
    doc_type: str
    pair_key: str
    ref_no: str | None
    reinsurer: str | None
    status: str
    accuracy: float | None
    input_filename: str | None
    gt_filename: str | None
    gen_filename: str | None
    input_extracted: dict[str, Any] | None
    gt_extracted: dict[str, Any] | None
    gen_extracted: dict[str, Any] | None
    diffs: list[dict[str, Any]] | None
    vlm_analysis: dict[str, Any] | None
    error_message: str | None


def _resolve_dataset_path(raw: str | None) -> Path:
    if not raw:
        return _DEFAULT_DATASET
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = _DEFAULT_DATASET.parent / candidate
    return candidate.resolve()


def _serialize_run(run: TestbenchRun) -> RunSummaryOut:
    return RunSummaryOut(
        id=str(run.id),
        label=run.label,
        dataset_path=run.dataset_path,
        status=run.status,
        doc_types=run.doc_types,
        summary=run.summary,
        error_message=run.error_message,
        created_at=run.created_at.isoformat() if run.created_at else "",
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
    )


def _serialize_pair_summary(p: TestbenchPair) -> PairSummary:
    return PairSummary(
        id=str(p.id),
        doc_type=p.doc_type,
        pair_key=p.pair_key,
        ref_no=p.ref_no,
        reinsurer=p.reinsurer,
        status=p.status,
        accuracy=float(p.accuracy) if p.accuracy is not None else None,
        input_filename=p.input_filename,
        gt_filename=p.gt_filename,
        gen_filename=p.gen_filename,
    )


@router.post("/runs", response_model=RunSummaryOut)
async def create_run(
    payload: RunCreate,
    db: AsyncSession = Depends(get_db),
) -> RunSummaryOut:
    """Scan the dataset folder, run the full pipeline, persist the
    results. Synchronous on purpose — the testbench is admin-only and
    the operator waits on the response to see weighted accuracy land
    in the UI."""
    dataset = _resolve_dataset_path(payload.dataset_path)
    if not dataset.is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"dataset_path not found or not a directory: {dataset}",
        )
    if payload.doc_types:
        unknown = [d for d in payload.doc_types if d not in DOC_TYPES]
        if unknown:
            raise HTTPException(
                status_code=400,
                detail=f"unknown doc_types: {unknown}. allowed: {list(DOC_TYPES)}",
            )

    run = TestbenchRun(
        label=payload.label,
        dataset_path=str(dataset),
        status="running",
    )
    db.add(run)
    await db.flush()

    try:
        await execute_run(db, run, dataset, payload.doc_types)
    except Exception as exc:
        logger.exception("Testbench run failed")
        run.status = "error"
        run.error_message = f"{type(exc).__name__}: {exc}"[:2000]

    await db.commit()
    await db.refresh(run)
    return _serialize_run(run)


@router.get("/runs", response_model=list[RunSummaryOut])
async def list_runs(
    db: AsyncSession = Depends(get_db),
) -> list[RunSummaryOut]:
    result = await db.execute(
        select(TestbenchRun).order_by(TestbenchRun.created_at.desc())
    )
    return [_serialize_run(r) for r in result.scalars().all()]


@router.get("/runs/{run_id}", response_model=RunDetailOut)
async def get_run(
    run_id: UUID, db: AsyncSession = Depends(get_db)
) -> RunDetailOut:
    result = await db.execute(
        select(TestbenchRun)
        .options(selectinload(TestbenchRun.pairs))
        .where(TestbenchRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    summary = _serialize_run(run)
    return RunDetailOut(
        **summary.model_dump(),
        pairs=[_serialize_pair_summary(p) for p in run.pairs],
    )


@router.get("/runs/{run_id}/pairs/{pair_id}", response_model=PairDetailOut)
async def get_pair(
    run_id: UUID,
    pair_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> PairDetailOut:
    result = await db.execute(
        select(TestbenchPair).where(
            TestbenchPair.id == pair_id, TestbenchPair.run_id == run_id
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="pair not found")
    return PairDetailOut(
        id=str(p.id),
        doc_type=p.doc_type,
        pair_key=p.pair_key,
        ref_no=p.ref_no,
        reinsurer=p.reinsurer,
        status=p.status,
        accuracy=float(p.accuracy) if p.accuracy is not None else None,
        input_filename=p.input_filename,
        gt_filename=p.gt_filename,
        gen_filename=p.gen_filename,
        input_extracted=p.input_extracted,
        gt_extracted=p.gt_extracted,
        gen_extracted=p.gen_extracted,
        diffs=p.diffs,
        vlm_analysis=p.vlm_analysis,
        error_message=p.error_message,
    )


@router.get("/runs/{run_id}/pairs/{pair_id}/file/{source}")
async def get_pair_file(
    run_id: UUID,
    pair_id: UUID,
    source: str,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Stream the original PDF for a pair so the runs UI can embed it
    in an iframe. ``source`` ∈ {input, ground_truth, generated}."""
    if source not in ("input", "ground_truth", "generated"):
        raise HTTPException(status_code=400, detail="invalid source")
    result = await db.execute(
        select(TestbenchPair, TestbenchRun).join(
            TestbenchRun, TestbenchRun.id == TestbenchPair.run_id
        ).where(
            TestbenchPair.id == pair_id, TestbenchPair.run_id == run_id
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="pair not found")
    pair, run = row
    filename = {
        "input": pair.input_filename,
        "ground_truth": pair.gt_filename,
        "generated": pair.gen_filename,
    }[source]
    if not filename:
        raise HTTPException(status_code=404, detail=f"{source} file absent")

    # Reconstruct the on-disk location from the run's dataset_path.
    # We intentionally re-derive rather than store the absolute path so
    # moving the dataset folder doesn't break old run records — when
    # the file is gone the endpoint 404s cleanly.
    base = Path(run.dataset_path)
    candidate = base / pair.doc_type / source / filename
    if not candidate.is_file():
        raise HTTPException(
            status_code=404, detail=f"file not found on disk: {candidate.name}"
        )
    return FileResponse(
        candidate,
        media_type="application/pdf",
        filename=candidate.name,
    )
