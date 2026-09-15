from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from arq import create_pool
from arq.connections import RedisSettings

from app.database import get_db
from app.models.policy import Policy, PolicyDocument
from app.config import settings

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/parse")
async def trigger_parse(
    doc_type: str | None = None,
    batch_size: int = Query(20, ge=1, le=100),
):
    """Enqueue document parsing job to ARQ worker."""
    pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    job = await pool.enqueue_job("parse_docs_job", doc_type=doc_type, batch_size=batch_size)
    await pool.close()
    return {"job_id": job.job_id, "status": "enqueued"}


@router.post("/parse-all")
async def trigger_parse_all():
    """Enqueue full document parsing job."""
    pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    job = await pool.enqueue_job("parse_all_docs_job")
    await pool.close()
    return {"job_id": job.job_id, "status": "enqueued"}


@router.get("/parse-status")
async def parse_status(db: AsyncSession = Depends(get_db)):
    """Check parsing progress."""
    total = (await db.execute(select(func.count(PolicyDocument.id)))).scalar() or 0
    parsed = (await db.execute(
        select(func.count(PolicyDocument.id)).where(PolicyDocument.extracted_data.isnot(None))
    )).scalar() or 0
    success = (await db.execute(
        select(func.count(PolicyDocument.id)).where(PolicyDocument.extracted_data.op('->>')('_status') == 'parsed')
    )).scalar() or 0
    failed = parsed - success

    return {
        "total": total,
        "parsed": parsed,
        "success": success,
        "failed": failed,
        "remaining": total - parsed,
        "progress_pct": round(parsed / total * 100, 1) if total > 0 else 0,
    }


class DocumentOut(BaseModel):
    id: int
    policy_id: int
    doc_type: str | None
    file_name: str
    file_path: str
    cover_note_no: str | None = None
    assured: str | None = None
    extracted_data: dict | None = None


class DocumentListResponse(BaseModel):
    items: list[DocumentOut]
    total: int
    page: int
    page_size: int


class DocumentStats(BaseModel):
    total: int
    by_type: list[dict]
    by_policy: list[dict]


@router.get("/stats", response_model=DocumentStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(PolicyDocument.id)))).scalar() or 0

    by_type = (await db.execute(
        select(PolicyDocument.doc_type, func.count(PolicyDocument.id).label("cnt"))
        .group_by(PolicyDocument.doc_type)
        .order_by(func.count(PolicyDocument.id).desc())
    )).all()

    by_policy = (await db.execute(
        select(Policy.cover_note_no, Policy.assured, func.count(PolicyDocument.id).label("cnt"))
        .join(PolicyDocument, PolicyDocument.policy_id == Policy.id)
        .group_by(Policy.id, Policy.cover_note_no, Policy.assured)
        .order_by(func.count(PolicyDocument.id).desc())
        .limit(20)
    )).all()

    return DocumentStats(
        total=total,
        by_type=[{"type": r[0] or "other", "count": r[1]} for r in by_type],
        by_policy=[{"cover_note": r[0], "assured": r[1], "count": r[2]} for r in by_policy],
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    doc_type: str | None = None,
    search: str | None = None,
    policy_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(PolicyDocument, Policy.cover_note_no, Policy.assured).join(Policy, PolicyDocument.policy_id == Policy.id)
    count_query = select(func.count(PolicyDocument.id))

    if doc_type:
        query = query.where(PolicyDocument.doc_type == doc_type)
        count_query = count_query.where(PolicyDocument.doc_type == doc_type)
    if policy_id:
        query = query.where(PolicyDocument.policy_id == policy_id)
        count_query = count_query.where(PolicyDocument.policy_id == policy_id)
    if search:
        query = query.where(PolicyDocument.file_name.ilike(f"%{search}%") | Policy.assured.ilike(f"%{search}%"))
        count_query = count_query.join(Policy, PolicyDocument.policy_id == Policy.id).where(
            PolicyDocument.file_name.ilike(f"%{search}%") | Policy.assured.ilike(f"%{search}%")
        )

    total = (await db.execute(count_query)).scalar() or 0
    rows = (await db.execute(
        query.order_by(PolicyDocument.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()

    items = [
        DocumentOut(
            id=r[0].id, policy_id=r[0].policy_id, doc_type=r[0].doc_type,
            file_name=r[0].file_name, file_path=r[0].file_path,
            cover_note_no=r[1], assured=r[2],
            extracted_data=r[0].extracted_data,
        )
        for r in rows
    ]

    return DocumentListResponse(items=items, total=total, page=page, page_size=page_size)
