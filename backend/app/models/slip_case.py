import uuid

from sqlalchemy import Column, String, DateTime, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from app.database import Base


class SlipCase(Base):
    """A saved run of the Slip Generator (SOC or PLA).

    Stores both AI-produced and user-edited state so we can evaluate accuracy
    over time (original vs edited) and track document lifecycle.
    """

    __tablename__ = "slip_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_type = Column(String(20), default="SOC", nullable=False)
    # "SOC" | "PLA" | "Bordereau SOC" | "Bordereau PLA"
    status = Column(String(20), default="processing", nullable=False)
    # processing → done → error. done = AI pipeline finished; edits after don't change this.

    input_text = Column(String)
    input_files = Column(JSONB)  # [{name, size, mime, path}]

    extracted = Column(JSONB)
    evidence = Column(JSONB)
    thinking = Column(JSONB)
    policy_match = Column(JSONB)
    socs = Column(JSONB)           # original AI proposal (immutable once saved)
    edited_socs = Column(JSONB)    # user-modified version (nullable until edited)
    # Bordereau-table column layout. Shape:
    #   [{ "key": str, "label": str, "align": "left|center|right",
    #      "visible": bool, "source": {"kind": ..., ...} }, ...]
    # ``NULL`` ⇒ frontend falls back to its built-in default set
    # (current 15 cols + Incident ID + Seq, the latter two off).
    # ``source.kind`` is one of ``index | field | computed | static |
    # custom`` — see ``BordereauColumn`` on the frontend for the
    # discriminated-union shape.
    columns_config = Column(JSONB)

    error_message = Column(String)

    # Lifecycle / review
    last_edited_at = Column(DateTime)
    edit_count = Column(Integer, default=0, nullable=False)
    reviewed_at = Column(DateTime)
    verdict = Column(String(20))  # "correct" | "needs_fix" | "wrong" | null

    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
