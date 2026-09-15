from sqlalchemy import Column, Integer, String, Date, Numeric, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class Policy(Base):
    """A policy groups contracts (by cover_note_no) and links to claims."""
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True, nullable=False, default=1)
    cover_note_no = Column(String(100), index=True, unique=True)
    assured = Column(String(500))
    line = Column(String(100))
    cedant = Column(String(100))
    period_from = Column(Date)
    period_to = Column(Date)
    currency = Column(String(20))
    total_premium = Column(Numeric)
    reinsurer_count = Column(Integer)
    contract_count = Column(Integer)
    claim_count = Column(Integer, default=0)
    status = Column(String(20), default="active")  # active / expired / cancelled
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PolicyClaimLink(Base):
    """Links a policy to its claims (via AI matching or manual)."""
    __tablename__ = "policy_claim_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    policy_id = Column(Integer, ForeignKey("policies.id"), index=True, nullable=False)
    claim_id = Column(Integer, ForeignKey("claims.id"), index=True, nullable=False)
    score = Column(Integer)
    method = Column(String(20))  # "auto" / "ai" / "manual"
    ai_reasoning = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class PolicyDocument(Base):
    """Documents attached to a policy (Closing, CD Note, STMT, etc.)"""
    __tablename__ = "policy_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    policy_id = Column(Integer, ForeignKey("policies.id"), index=True, nullable=False)
    doc_type = Column(String(50))  # "closing" / "cd_note" / "stmt" / "slip" / "endorsement"
    file_name = Column(String(500))
    file_path = Column(String(1000))
    extracted_data = Column(JSON)  # AI-extracted structured data
    created_at = Column(DateTime, server_default=func.now())
