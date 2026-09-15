from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, Text, ForeignKey
from app.database import Base


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True, nullable=False, default=1)
    sheet_name = Column(String(20))
    booking_month = Column(String(50))
    soc_received = Column(String(200))
    soc_sent = Column(String(200))
    account_name = Column(String(500), index=True)
    line = Column(String(100), index=True)
    policy_period = Column(Date)
    dol = Column(Date)
    reinsurer = Column(String(100), index=True)
    currency = Column(String(20))
    total_amount = Column(Numeric)
    share = Column(Numeric)
    origin_currency = Column(Numeric)
    roe = Column(Numeric)
    krw_amount = Column(Numeric)
    soc_amount = Column(Numeric)
    cedant = Column(String(100), index=True)
    status = Column(String(50), index=True)
    received_date = Column(Date)
    paid_date = Column(Date)
    account_mgr = Column(String(100))
    ref_no = Column(String(200), index=True)
    remarks = Column(Text)
    workflow_status = Column(String(30), default="soc_received", index=True)
    assigned_to = Column(String(100))
    case_id = Column(Integer, ForeignKey("claim_cases.id"), nullable=True, index=True)

    # Phase 2 KB monthly-diff bookkeeping. Populated by Phase 3a's
    # WorkflowSyncer; nullable for the 13k pre-existing rows that
    # haven't been touched by the diff engine yet.
    last_transition = Column(String(30), nullable=True, index=True)
    last_transition_at = Column(DateTime, nullable=True)
    last_diff_audit_severity = Column(String(20), nullable=True)
