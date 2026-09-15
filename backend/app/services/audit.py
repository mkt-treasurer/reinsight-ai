import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


async def log_change(
    db: AsyncSession,
    table_name: str,
    record_id: int,
    action: str,
    changes: dict | None = None,
    actor_type: str = "human",
    actor_name: str | None = None,
    company_id: int = 1,
):
    entry = AuditLog(
        company_id=company_id,
        table_name=table_name,
        record_id=record_id,
        action=action,
        actor_type=actor_type,
        actor_name=actor_name,
        changes=changes,
    )
    db.add(entry)
    await db.flush()
    logger.info(f"Audit: {action} {table_name}#{record_id} by {actor_type}/{actor_name}")
