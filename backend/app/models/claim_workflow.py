from sqlalchemy import Column, Integer, String, DateTime, Text, Numeric, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from app.database import Base


class ClaimCase(Base):
    """A claim case groups the full processing lifecycle."""
    __tablename__ = "claim_cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), default=1)

    # Intake info
    account_name = Column(String(500))
    cedant = Column(String(100))
    line = Column(String(100))
    ref_no = Column(String(200))
    dol = Column(String(100))  # date of loss
    currency = Column(String(20))
    total_amount = Column(Numeric)
    description = Column(Text)

    # AI analysis results
    matched_policy_id = Column(Integer, ForeignKey("policies.id"), nullable=True)
    duplicate_check = Column(JSON)  # {is_duplicate, similar_claims: [...]}
    ai_summary = Column(Text)

    # Workflow
    status = Column(String(30), default="intake", index=True)
    # intake → analyzed → draft_ready → review → sent → awaiting_payment → completed → deleted
    is_deleted = Column(Boolean, default=False, index=True)
    assigned_to = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    sent_at = Column(DateTime)
    paid_at = Column(DateTime)


class ClaimDraft(Base):
    """SOC draft for each reinsurer."""
    __tablename__ = "claim_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("claim_cases.id"), index=True, nullable=False)
    reinsurer = Column(String(100))
    share = Column(Numeric)
    amount = Column(Numeric)  # total_amount * share
    currency = Column(String(20))
    subject = Column(String(500))
    body = Column(Text)  # email body
    status = Column(String(20), default="draft")  # draft → sent → paid
    sent_at = Column(DateTime)
    paid_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
