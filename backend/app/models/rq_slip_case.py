import uuid

from sqlalchemy import Column, String, DateTime, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from app.database import Base


class RqSlipCase(Base):
    """A saved run of the placement RQ-slip tool (insightre.ai placement track).

    ISOLATED experimental table — no FK to any existing table, no relationships.
    Stores both the AI-extracted state and the user-edited slip so accuracy can
    be evaluated over time (original vs edited) and review status tracked.
    Mirrors the claims-side ``slip_cases`` lifecycle/verdict conventions.
    """

    __tablename__ = "rq_slip_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Denormalized headline fields for cheap list rendering / search.
    insured = Column(String(512))
    line = Column(String(512))
    reinsured = Column(String(512))

    status = Column(String(20), default="draft", nullable=False)
    # "draft" → "reviewed" → "sent"

    extracted = Column(JSONB)  # original AI proposal (immutable once saved)
    slip = Column(JSONB)       # user-edited slip (nullable until edited)

    note = Column(String)

    # Lifecycle / review
    last_edited_at = Column(DateTime)
    edit_count = Column(Integer, default=0, nullable=False)
    reviewed_at = Column(DateTime)
    verdict = Column(String(20))  # "correct" | "needs_fix" | "wrong" | null

    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
