from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, distinct, case, literal_column
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.claim import Claim
from app.schemas.claim import ClaimOut, ClaimListResponse, ClaimCreate, ClaimUpdate
from app.services.audit import log_change

router = APIRouter(prefix="/api/claims", tags=["claims"])


# --- By Account schemas ---

class AccountSummary(BaseModel):
    account_name: str
    total_claims: int
    open_claims: int
    closed_claims: int
    total_krw: float
    total_soc: float
    open_krw: float
    reinsurer_count: int
    line_count: int
    latest_dol: str | None = None

    class Config:
        from_attributes = True


class AccountSummaryList(BaseModel):
    items: list[AccountSummary]
    total: int
    page: int
    page_size: int


# --- By Account endpoint ---

@router.get("/by-account", response_model=AccountSummaryList)
async def claims_by_account(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    search: str | None = None,
    sort_by: str = Query("total_krw", enum=["total_krw", "total_claims", "open_claims", "account_name"]),
    db: AsyncSession = Depends(get_db),
):
    base_filter = Claim.account_name.isnot(None)
    if search:
        base_filter = base_filter & Claim.account_name.ilike(f"%{search}%")

    # Count distinct accounts
    count_q = select(func.count(distinct(Claim.account_name))).where(base_filter)
    total = (await db.execute(count_q)).scalar() or 0

    # Aggregation query
    query = (
        select(
            Claim.account_name,
            func.count(Claim.id).label("total_claims"),
            func.count(Claim.id).filter(Claim.status == "Open").label("open_claims"),
            func.count(Claim.id).filter(Claim.status == "Closed").label("closed_claims"),
            func.coalesce(func.sum(Claim.krw_amount), 0).label("total_krw"),
            func.coalesce(func.sum(Claim.soc_amount), 0).label("total_soc"),
            func.coalesce(
                func.sum(case((Claim.status == "Open", Claim.krw_amount), else_=0)), 0
            ).label("open_krw"),
            func.count(distinct(Claim.reinsurer)).label("reinsurer_count"),
            func.count(distinct(Claim.line)).label("line_count"),
            func.max(Claim.dol).label("latest_dol"),
        )
        .where(base_filter)
        .group_by(Claim.account_name)
    )

    # Sort
    sort_map = {
        "total_krw": literal_column("total_krw").desc(),
        "total_claims": literal_column("total_claims").desc(),
        "open_claims": literal_column("open_claims").desc(),
        "account_name": Claim.account_name.asc(),
    }
    query = query.order_by(sort_map.get(sort_by, literal_column("total_krw").desc()))
    query = query.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(query)).all()

    items = [
        AccountSummary(
            account_name=r.account_name,
            total_claims=r.total_claims,
            open_claims=r.open_claims,
            closed_claims=r.closed_claims,
            total_krw=float(r.total_krw),
            total_soc=float(r.total_soc),
            open_krw=float(r.open_krw),
            reinsurer_count=r.reinsurer_count,
            line_count=r.line_count,
            latest_dol=str(r.latest_dol) if r.latest_dol else None,
        )
        for r in rows
    ]

    return AccountSummaryList(items=items, total=total, page=page, page_size=page_size)


@router.get("", response_model=ClaimListResponse)
async def list_claims(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    line: str | None = None,
    reinsurer: str | None = None,
    cedant: str | None = None,
    status: str | None = None,
    search: str | None = None,
    ref_no: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import or_

    query = select(Claim).where(Claim.status != "Deleted")
    count_query = select(func.count(Claim.id)).where(Claim.status != "Deleted")

    if line:
        query = query.where(Claim.line == line)
        count_query = count_query.where(Claim.line == line)
    if reinsurer:
        query = query.where(Claim.reinsurer == reinsurer)
        count_query = count_query.where(Claim.reinsurer == reinsurer)
    if cedant:
        query = query.where(Claim.cedant == cedant)
        count_query = count_query.where(Claim.cedant == cedant)
    if status:
        query = query.where(Claim.status == status)
        count_query = count_query.where(Claim.status == status)
    if ref_no:
        query = query.where(Claim.ref_no == ref_no)
        count_query = count_query.where(Claim.ref_no == ref_no)
    if search:
        search_filter = or_(Claim.account_name.ilike(f"%{search}%"), Claim.ref_no.ilike(f"%{search}%"), Claim.reinsurer.ilike(f"%{search}%"))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = (await db.execute(count_query)).scalar()
    items = (
        await db.execute(
            query.order_by(Claim.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return ClaimListResponse(
        items=[ClaimOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{claim_id}", response_model=ClaimOut)
async def get_claim(claim_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return ClaimOut.model_validate(claim)


@router.post("", response_model=ClaimOut, status_code=201)
async def create_claim(data: ClaimCreate, db: AsyncSession = Depends(get_db)):
    claim = Claim(**data.model_dump(exclude_none=True), company_id=1)
    db.add(claim)
    await db.commit()
    await db.refresh(claim)
    await log_change(db, "claims", claim.id, "create", changes=data.model_dump(exclude_none=True), actor_type="human")
    await db.commit()
    return ClaimOut.model_validate(claim)


@router.put("/{claim_id}", response_model=ClaimOut)
async def update_claim(claim_id: int, data: ClaimUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    old_values = {}
    for key, val in data.model_dump(exclude_none=True).items():
        old_val = getattr(claim, key, None)
        if old_val != val:
            old_values[key] = {"old": str(old_val) if old_val is not None else None, "new": str(val)}
        setattr(claim, key, val)
    await db.commit()
    await db.refresh(claim)
    if old_values:
        await log_change(db, "claims", claim.id, "update", changes=old_values, actor_type="human")
        await db.commit()
    return ClaimOut.model_validate(claim)


@router.delete("/{claim_id}")
async def delete_claim(claim_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    await log_change(db, "claims", claim.id, "delete", actor_type="human")
    await db.commit()
    await db.delete(claim)
    await db.commit()
    return {"status": "deleted"}
