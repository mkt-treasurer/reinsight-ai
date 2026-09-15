from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    table_name = Column(String(50), index=True, nullable=False)  # "contracts", "claims", "cover_notes"
    record_id = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False)  # "create", "update", "delete"
    actor_type = Column(String(20), nullable=False)  # "human", "ai"
    actor_name = Column(String(100))  # username or "gemini-flash"
    changes = Column(JSON)  # {"field": {"old": x, "new": y}} for updates, full record for create/delete
    created_at = Column(DateTime, server_default=func.now())
