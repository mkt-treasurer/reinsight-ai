from sqlalchemy import Column, Integer, String, DateTime, Text, Numeric, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from app.database import Base


class ContractCase(Base):
    """A contract case for the processing pipeline."""
    __tablename__ = "contract_cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), default=1)

    # Intake
    assured = Column(String(500))
    cedant = Column(String(100))
    line = Column(String(100))
    cover_note_no = Column(String(100))
    period_from = Column(String(50))
    period_to = Column(String(50))
    currency = Column(String(20))
    gross_premium = Column(Numeric)
    description = Column(Text)

    # AI
    matched_policy_id = Column(Integer, ForeignKey("policies.id"), nullable=True)
    ai_summary = Column(Text)

    # Workflow
    status = Column(String(30), default="intake", index=True)
    # intake → analyzed → draft_ready → sent → payment_received → completed
    is_deleted = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ContractDraft(Base):
    """Closing/STMT/CD Note draft per reinsurer."""
    __tablename__ = "contract_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("contract_cases.id"), index=True, nullable=False)
    reinsurer = Column(String(100))
    share = Column(Numeric)
    ri_premium = Column(Numeric)
    commission = Column(Numeric)
    net_premium = Column(Numeric)
    doc_type = Column(String(20))  # closing, stmt, cd_note
    subject = Column(String(500))
    body = Column(Text)
    status = Column(String(20), default="draft")  # draft → sent → paid
    sent_at = Column(DateTime)
    paid_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
