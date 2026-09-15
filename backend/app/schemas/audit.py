from datetime import datetime
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    table_name: str
    record_id: int
    action: str
    actor_type: str
    actor_name: str | None = None
    changes: dict | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    total: int
