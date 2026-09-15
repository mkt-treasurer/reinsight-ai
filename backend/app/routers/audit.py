from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogOut, AuditLogListResponse

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    table_name: str | None = None,
    record_id: int | None = None,
    actor_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if table_name:
        query = query.where(AuditLog.table_name == table_name)
        count_query = count_query.where(AuditLog.table_name == table_name)
    if record_id:
        query = query.where(AuditLog.record_id == record_id)
        count_query = count_query.where(AuditLog.record_id == record_id)
    if actor_type:
        query = query.where(AuditLog.actor_type == actor_type)
        count_query = count_query.where(AuditLog.actor_type == actor_type)

    total = (await db.execute(count_query)).scalar()
    items = (await db.execute(
        query.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(i) for i in items],
        total=total,
    )
