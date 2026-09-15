from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class ContractClaimLink(Base):
    __tablename__ = "contract_claim_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), index=True, nullable=False)
    claim_id = Column(Integer, ForeignKey("claims.id"), index=True, nullable=False)
    score = Column(Integer, nullable=False)
    signals = Column(JSON)  # ["reinsurer=ACE KR", "name=20pt", ...]
    ai_reasoning = Column(Text)  # Gemini's explanation
    status = Column(String(20), default="candidate")  # candidate / confirmed / rejected
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
