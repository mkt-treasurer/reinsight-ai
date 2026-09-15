from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contract import Contract
from app.models.claim import Claim
from app.models.cover_note import CoverNote

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchResult(BaseModel):
    type: str  # "contract" | "claim" | "cover_note"
    id: int
    title: str
    subtitle: str
    url: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    total: int


@router.get("", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    term = f"%{q}%"
    results: list[SearchResult] = []

    # Search contracts
    contracts = (await db.execute(
        select(Contract)
        .where(or_(
            Contract.assured.ilike(term),
            Contract.cover_note_no.ilike(term),
            Contract.reinsurer.ilike(term),
            Contract.project_name.ilike(term),
        ))
        .order_by(Contract.id.desc())
        .limit(limit)
    )).scalars().all()

    for c in contracts:
        results.append(SearchResult(
            type="contract",
            id=c.id,
            title=c.assured or f"Contract #{c.id}",
            subtitle=f"{c.cover_note_no or ''} / {c.reinsurer or ''} / {c.line or ''} / {c.year or ''}",
            url=f"/ins/contracts/{c.id}",
        ))

    # Search claims
    claims = (await db.execute(
        select(Claim)
        .where(or_(
            Claim.account_name.ilike(term),
            Claim.ref_no.ilike(term),
            Claim.reinsurer.ilike(term),
        ))
        .order_by(Claim.id.desc())
        .limit(limit)
    )).scalars().all()

    for cl in claims:
        results.append(SearchResult(
            type="claim",
            id=cl.id,
            title=cl.account_name or f"Claim #{cl.id}",
            subtitle=f"{cl.ref_no or ''} / {cl.reinsurer or ''} / {cl.line or ''} / {cl.status or ''}",
            url=f"/ins/claims/by-account/{cl.account_name}" if cl.account_name else f"/ins/claims",
        ))

    # Search cover notes
    cover_notes = (await db.execute(
        select(CoverNote)
        .where(or_(
            CoverNote.cover_note_number.ilike(term),
            CoverNote.assured.ilike(term),
        ))
        .order_by(CoverNote.id.desc())
        .limit(limit)
    )).scalars().all()

    for cn in cover_notes:
        results.append(SearchResult(
            type="cover_note",
            id=cn.id,
            title=cn.cover_note_number or f"CN #{cn.id}",
            subtitle=f"{cn.assured or ''} / {cn.line or ''}",
            url=f"/ins/contracts",
        ))

    return SearchResponse(query=q, results=results[:limit], total=len(results))
