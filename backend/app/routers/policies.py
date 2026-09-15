from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.policy import Policy, PolicyClaimLink, PolicyDocument
from app.models.contract import Contract
from app.models.claim import Claim
from app.services.policy_builder import build_policies, link_claims_to_policies
from app.services.file_scanner import scan_and_match

router = APIRouter(prefix="/api/policies", tags=["policies"])


class PolicyOut(BaseModel):
    id: int
    cover_note_no: str | None
    assured: str | None
    line: str | None
    cedant: str | None
    period_from: date | None
    period_to: date | None
    currency: str | None
    total_premium: float | None
    reinsurer_count: int | None
    contract_count: int | None
    claim_count: int | None
    status: str | None

    class Config:
        from_attributes = True


class PolicyListResponse(BaseModel):
    items: list[PolicyOut]
    total: int
    page: int
    page_size: int


class PolicyDetail(PolicyOut):
    contracts: list[dict]
    claims: list[dict]
    documents: list[dict]


@router.post("/build")
async def trigger_build(db: AsyncSession = Depends(get_db)):
    result = await build_policies(db)
    link_result = await link_claims_to_policies(db)
    return {**result, **link_result}


@router.post("/scan-files")
async def trigger_file_scan(db: AsyncSession = Depends(get_db)):
    return await scan_and_match(db)


@router.get("", response_model=PolicyListResponse)
async def list_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    search: str | None = None,
    has_claims: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Policy)
    count_query = select(func.count(Policy.id))

    if search:
        query = query.where(Policy.assured.ilike(f"%{search}%") | Policy.cover_note_no.ilike(f"%{search}%"))
        count_query = count_query.where(Policy.assured.ilike(f"%{search}%") | Policy.cover_note_no.ilike(f"%{search}%"))
    if has_claims is True:
        query = query.where(Policy.claim_count > 0)
        count_query = count_query.where(Policy.claim_count > 0)
    elif has_claims is False:
        query = query.where((Policy.claim_count == 0) | (Policy.claim_count.is_(None)))
        count_query = count_query.where((Policy.claim_count == 0) | (Policy.claim_count.is_(None)))

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(Policy.total_premium.desc().nullslast()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    return PolicyListResponse(
        items=[PolicyOut.model_validate(i) for i in items],
        total=total, page=page, page_size=page_size,
    )


@router.get("/{policy_id}", response_model=PolicyDetail)
async def get_policy(policy_id: int, db: AsyncSession = Depends(get_db)):
    policy = (await db.execute(select(Policy).where(Policy.id == policy_id))).scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    # Get contracts
    contracts = (await db.execute(
        select(Contract).where(Contract.cover_note_no == policy.cover_note_no)
    )).scalars().all()
    contract_dicts = [
        {"id": c.id, "reinsurer": c.reinsurer, "share": float(c.share) if c.share else None,
         "ri_prem": float(c.ri_prem) if c.ri_prem else None, "ri_commission": float(c.ri_commission) if c.ri_commission else None,
         "rec_date": str(c.rec_date) if c.rec_date else None, "paid_date": str(c.paid_date) if c.paid_date else None}
        for c in contracts
    ]

    # Get linked claims
    links = (await db.execute(
        select(PolicyClaimLink).where(PolicyClaimLink.policy_id == policy_id)
    )).scalars().all()
    claim_dicts = []
    for link in links:
        cl = (await db.execute(select(Claim).where(Claim.id == link.claim_id))).scalar_one_or_none()
        if cl:
            claim_dicts.append({
                "id": cl.id, "account_name": cl.account_name, "reinsurer": cl.reinsurer,
                "ref_no": cl.ref_no, "krw_amount": float(cl.krw_amount) if cl.krw_amount else None,
                "status": cl.status, "dol": str(cl.dol) if cl.dol else None,
                "link_score": link.score, "link_method": link.method,
            })

    # Get documents
    docs = (await db.execute(
        select(PolicyDocument).where(PolicyDocument.policy_id == policy_id)
    )).scalars().all()
    doc_dicts = [
        {"id": d.id, "doc_type": d.doc_type, "file_name": d.file_name, "file_path": d.file_path}
        for d in docs
    ]

    base = PolicyOut.model_validate(policy)
    return PolicyDetail(**base.model_dump(), contracts=contract_dicts, claims=claim_dicts, documents=doc_dicts)
