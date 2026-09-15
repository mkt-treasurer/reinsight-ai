from pathlib import Path
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.data_audit import audit_actual_vs_db
from app.services.claim_file_audit import audit_claims_vs_files

router = APIRouter(prefix="/api/audit-data", tags=["data_audit"])

DATA_DIR = Path("/app/data")


@router.get("/preview-msg")
async def preview_msg(path: str = Query(...)):
    """Parse and return MSG email content as text."""
    file_path = DATA_DIR / path
    if not file_path.exists() or not str(file_path).endswith(".msg"):
        return {"error": "File not found or not .msg"}
    try:
        import extract_msg
        msg = extract_msg.Message(str(file_path))
        result = {
            "subject": msg.subject,
            "sender": str(msg.sender) if msg.sender else None,
            "to": str(msg.to) if msg.to else None,
            "date": str(msg.date) if msg.date else None,
            "body": msg.body[:3000] if msg.body else None,
        }
        msg.close()
        return result
    except Exception as e:
        return {"error": str(e)}


@router.post("/premium")
async def run_premium_audit(db: AsyncSession = Depends(get_db)):
    """Audit STMT files vs DB contracts."""
    return await audit_actual_vs_db(db)


@router.post("/claims")
async def run_claims_audit(db: AsyncSession = Depends(get_db)):
    """Audit DB claims vs cached file extractions (fast if cached)."""
    return await audit_claims_vs_files(db)


@router.post("/tag-all")
async def trigger_tag_all():
    """Register + tag ALL claim files with AI."""
    from arq import create_pool
    from arq.connections import RedisSettings
    from app.config import settings as cfg
    pool = await create_pool(RedisSettings.from_dsn(cfg.redis_url))
    job = await pool.enqueue_job("tag_all_files_job")
    await pool.close()
    return {"job_id": job.job_id, "status": "enqueued"}


@router.get("/tag-progress")
async def tag_progress(db: AsyncSession = Depends(get_db)):
    from app.models.file_extraction import FileExtraction
    total = (await db.execute(select(func.count(FileExtraction.id)))).scalar() or 0
    pending = (await db.execute(select(func.count(FileExtraction.id)).where(FileExtraction.status == "pending"))).scalar() or 0
    parsed = (await db.execute(select(func.count(FileExtraction.id)).where(FileExtraction.status == "parsed"))).scalar() or 0
    failed = (await db.execute(select(func.count(FileExtraction.id)).where(FileExtraction.status == "failed"))).scalar() or 0
    return {
        "total": total, "pending": pending, "parsed": parsed, "failed": failed,
        "progress_pct": round((parsed + failed) / max(total, 1) * 100, 1),
    }


@router.post("/retry-failed")
async def retry_failed(db: AsyncSession = Depends(get_db)):
    """Reset failed files to pending so they get re-processed."""
    from app.models.file_extraction import FileExtraction
    from sqlalchemy import update
    result = await db.execute(
        update(FileExtraction).where(FileExtraction.status == "failed").values(status="pending")
    )
    await db.commit()
    return {"reset_count": result.rowcount}


@router.post("/extract-all")
async def trigger_extract_all():
    """Enqueue extraction job to ARQ worker."""
    from arq import create_pool
    from arq.connections import RedisSettings
    from app.config import settings as cfg
    pool = await create_pool(RedisSettings.from_dsn(cfg.redis_url))
    job = await pool.enqueue_job("extract_claim_files_job")
    await pool.close()
    return {"job_id": job.job_id, "status": "enqueued"}


@router.get("/extract-progress")
async def extract_progress(db: AsyncSession = Depends(get_db)):
    """Check extraction progress."""
    from app.models.file_extraction import FileExtraction
    from app.services.claim_file_audit import _scan_claim_files

    file_index = _scan_claim_files()
    total_extractable = sum(
        1 for entries in file_index.values()
        for e in entries for f in e["files"]
        if f["type"] == "xlsx"
    )

    total_cached = (await db.execute(
        select(func.count(FileExtraction.id))
    )).scalar() or 0
    parsed = (await db.execute(
        select(func.count(FileExtraction.id)).where(FileExtraction.status == "parsed")
    )).scalar() or 0
    failed = (await db.execute(
        select(func.count(FileExtraction.id)).where(FileExtraction.status == "failed")
    )).scalar() or 0

    return {
        "total_files": total_extractable,
        "processed": total_cached,
        "parsed": parsed,
        "failed": failed,
        "remaining": max(0, total_extractable - total_cached),
        "progress_pct": round(total_cached / max(total_extractable, 1) * 100, 1),
    }


@router.post("/extract-file")
async def extract_single_file(path: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Extract amounts from a single file using Gemini multimodal. Caches result."""
    from app.services.claim_file_audit import _extract_amounts_pdf_multimodal, _extract_amounts_xlsx
    from app.models.file_extraction import FileExtraction
    import re

    file_path = DATA_DIR / path
    if not file_path.exists():
        return {"error": "File not found"}

    # Check cache
    existing = (await db.execute(
        select(FileExtraction).where(FileExtraction.file_path == path)
    )).scalar_one_or_none()
    if existing and existing.extracted_data and existing.extracted_data.get("total_100") is not None:
        return existing.extracted_data

    # Extract
    extracted = None
    if file_path.suffix.lower() == ".xlsx":
        extracted = _extract_amounts_xlsx(file_path)
    elif file_path.suffix.lower() == ".pdf":
        extracted = _extract_amounts_pdf_multimodal(file_path)

    if not extracted:
        return {"total_100": None, "error": "Could not extract"}

    # Cache
    ref_match = re.search(r'(C?\d{4,}[-\d]+)', file_path.stem)
    ref_no = ref_match.group(1) if ref_match else None

    if existing:
        existing.extracted_data = extracted
        existing.status = "parsed"
    else:
        fe = FileExtraction(
            file_path=path, file_name=file_path.name, file_type=file_path.suffix.lower()[1:],
            ref_no=ref_no, extracted_data=extracted, status="parsed",
        )
        db.add(fe)
    await db.commit()
    return extracted
