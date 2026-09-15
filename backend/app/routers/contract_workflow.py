from datetime import datetime as dt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contract_workflow import ContractCase, ContractDraft
from app.models.policy import Policy
from app.services.contract_processor import process_contract

router = APIRouter(prefix="/api/contract-cases", tags=["contract_workflow"])


class CaseCreate(BaseModel):
    assured: str
    cedant: str | None = None
    line: str | None = None
    cover_note_no: str | None = None
    period_from: str | None = None
    period_to: str | None = None
    currency: str | None = "KRW"
    gross_premium: float | None = None
    description: str | None = None


class CaseOut(BaseModel):
    id: int
    assured: str | None
    cedant: str | None
    line: str | None
    cover_note_no: str | None
    currency: str | None
    gross_premium: float | None
    matched_policy_id: int | None
    ai_summary: str | None
    status: str
    created_at: dt | None = None

    class Config:
        from_attributes = True


class DraftOut(BaseModel):
    id: int
    case_id: int
    reinsurer: str | None
    share: float | None
    ri_premium: float | None
    commission: float | None
    net_premium: float | None
    doc_type: str | None
    subject: str | None
    body: str | None
    status: str
    sent_at: dt | None = None
    paid_at: dt | None = None

    class Config:
        from_attributes = True


class CaseDetail(CaseOut):
    drafts: list[DraftOut]
    policy_assured: str | None = None
    policy_cover_note: str | None = None


# --- Endpoints ---

@router.get("/pipeline")
async def pipeline(db: AsyncSession = Depends(get_db)):
    statuses = ["intake", "analyzing", "analyzed", "draft_ready", "sent", "payment_received", "completed"]
    counts = {}
    for s in statuses:
        counts[s] = (await db.execute(
            select(func.count(ContractCase.id)).where(ContractCase.status == s).where((ContractCase.is_deleted == False) | (ContractCase.is_deleted.is_(None)))
        )).scalar() or 0
    return counts


@router.get("/demo-data")
async def demo_data():
    return [
        {"assured": "Hyundai Motor Company", "cedant": "HM", "line": "D&O", "cover_note_no": "CF260001",
         "period_from": "2026-01-01", "period_to": "2027-01-01", "currency": "KRW", "gross_premium": 1165000000,
         "description": "현대자동차 D&O 갱신"},
        {"assured": "Samsung Display", "cedant": "SS", "line": "PAR", "cover_note_no": "CF250033-NEW",
         "period_from": "2026-04-01", "period_to": "2027-04-01", "currency": "KRW", "gross_premium": 850000000,
         "description": "삼성디스플레이 재산종합보험 신규"},
        {"assured": "Daesang Corp.", "cedant": "KR", "line": "PAR", "cover_note_no": "PF260-NEW",
         "period_from": "2026-03-01", "period_to": "2027-03-01", "currency": "KRW", "gross_premium": 320000000,
         "description": "대상 메인공장 PAR 갱신"},
    ]


@router.post("", response_model=CaseOut, status_code=201)
async def create_case(data: CaseCreate, db: AsyncSession = Depends(get_db)):
    case = ContractCase(**data.model_dump(), company_id=1)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return CaseOut.model_validate(case)


@router.post("/{case_id}/process")
async def trigger_process(case_id: int, db: AsyncSession = Depends(get_db)):
    return await process_contract(case_id, db)


@router.get("", response_model=list[CaseOut])
async def list_cases(status: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(ContractCase).where((ContractCase.is_deleted == False) | (ContractCase.is_deleted.is_(None))).order_by(ContractCase.id.desc())
    if status:
        query = query.where(ContractCase.status == status)
    return [CaseOut.model_validate(c) for c in (await db.execute(query.limit(100))).scalars().all()]


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case(case_id: int, db: AsyncSession = Depends(get_db)):
    case = (await db.execute(select(ContractCase).where(ContractCase.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404)
    drafts = (await db.execute(select(ContractDraft).where(ContractDraft.case_id == case_id).order_by(ContractDraft.ri_premium.desc()))).scalars().all()
    policy_assured, policy_cn = None, None
    if case.matched_policy_id:
        p = (await db.execute(select(Policy).where(Policy.id == case.matched_policy_id))).scalar_one_or_none()
        if p: policy_assured, policy_cn = p.assured, p.cover_note_no
    base = CaseOut.model_validate(case)
    return CaseDetail(**base.model_dump(), drafts=[DraftOut.model_validate(d) for d in drafts], policy_assured=policy_assured, policy_cover_note=policy_cn)


@router.post("/{case_id}/send")
async def send_drafts(case_id: int, db: AsyncSession = Depends(get_db)):
    case = (await db.execute(select(ContractCase).where(ContractCase.id == case_id))).scalar_one_or_none()
    if not case: raise HTTPException(status_code=404)
    drafts = (await db.execute(select(ContractDraft).where(ContractDraft.case_id == case_id, ContractDraft.status == "draft"))).scalars().all()
    now = dt.utcnow()
    for d in drafts: d.status = "sent"; d.sent_at = now
    case.status = "sent"
    await db.commit()
    return {"sent_count": len(drafts)}


@router.post("/{case_id}/mark-paid")
async def mark_paid(case_id: int, db: AsyncSession = Depends(get_db)):
    case = (await db.execute(select(ContractCase).where(ContractCase.id == case_id))).scalar_one_or_none()
    if not case: raise HTTPException(status_code=404)
    drafts = (await db.execute(select(ContractDraft).where(ContractDraft.case_id == case_id))).scalars().all()
    now = dt.utcnow()
    for d in drafts: d.status = "paid"; d.paid_at = now
    case.status = "completed"
    await db.commit()
    return {"status": "completed"}


@router.delete("/{case_id}")
async def delete_case(case_id: int, db: AsyncSession = Depends(get_db)):
    case = (await db.execute(select(ContractCase).where(ContractCase.id == case_id))).scalar_one_or_none()
    if not case: raise HTTPException(status_code=404)
    case.is_deleted = True; case.status = "deleted"
    await db.commit()
    return {"status": "deleted"}
