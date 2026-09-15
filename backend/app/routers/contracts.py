import re
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contract import Contract
from app.models.claim import Claim
from app.schemas.contract import ContractOut, ContractListResponse, ContractCreate, ContractUpdate
from app.services.audit import log_change

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


# --- By Cover Note grouping ---

class CoverNoteGroup(BaseModel):
    cover_note_no: str
    assured: str | None
    line: str | None
    cedant: str | None
    period_from: str | None
    period_to: str | None
    contract_count: int
    reinsurer_count: int
    total_premium: float
    total_commission: float
    policy_id: int | None = None
    claim_count: int | None = None
    doc_count: int | None = None


class CoverNoteGroupList(BaseModel):
    items: list[CoverNoteGroup]
    total: int
    page: int
    page_size: int


@router.get("/by-cover-note", response_model=CoverNoteGroupList)
async def contracts_by_cover_note(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    search: str | None = None,
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import distinct, literal_column, case
    from app.models.policy import Policy, PolicyClaimLink, PolicyDocument

    base = Contract.cover_note_no.isnot(None)
    if search:
        base = base & (Contract.assured.ilike(f"%{search}%") | Contract.cover_note_no.ilike(f"%{search}%"))
    if year:
        base = base & (Contract.year == year)

    count_q = select(func.count(distinct(Contract.cover_note_no))).where(base)
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        select(
            Contract.cover_note_no,
            func.min(Contract.assured).label("assured"),
            func.min(Contract.line).label("line"),
            func.min(Contract.cedant).label("cedant"),
            func.min(Contract.period_from).label("period_from"),
            func.max(Contract.period_to).label("period_to"),
            func.count(Contract.id).label("contract_count"),
            func.count(distinct(Contract.reinsurer)).label("reinsurer_count"),
            func.coalesce(func.sum(Contract.ri_prem), 0).label("total_premium"),
            func.coalesce(func.sum(Contract.ri_commission), 0).label("total_commission"),
        )
        .where(base)
        .group_by(Contract.cover_note_no)
        .order_by(func.sum(func.abs(Contract.ri_prem)).desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = (await db.execute(query)).all()

    items = []
    for r in rows:
        # Find linked policy
        policy = (await db.execute(
            select(Policy).where(Policy.cover_note_no == r.cover_note_no)
        )).scalar_one_or_none()

        claim_count = 0
        doc_count = 0
        policy_id = None
        if policy:
            policy_id = policy.id
            claim_count = (await db.execute(
                select(func.count(PolicyClaimLink.id)).where(PolicyClaimLink.policy_id == policy.id)
            )).scalar() or 0
            doc_count = (await db.execute(
                select(func.count(PolicyDocument.id)).where(PolicyDocument.policy_id == policy.id)
            )).scalar() or 0

        items.append(CoverNoteGroup(
            cover_note_no=r.cover_note_no,
            assured=r.assured,
            line=r.line,
            cedant=r.cedant,
            period_from=str(r.period_from) if r.period_from else None,
            period_to=str(r.period_to) if r.period_to else None,
            contract_count=r.contract_count,
            reinsurer_count=r.reinsurer_count,
            total_premium=float(r.total_premium),
            total_commission=float(r.total_commission),
            policy_id=policy_id,
            claim_count=claim_count,
            doc_count=doc_count,
        ))

    return CoverNoteGroupList(items=items, total=total, page=page, page_size=page_size)


# --- Claim candidate matching ---

def _normalize(s: str | None) -> str:
    if not s: return ""
    s = s.strip().lower()
    for rm in ["co.,ltd", "co., ltd", "co.,ltd.", "inc.", "inc", "corp.", "corp", "ltd.", "ltd", "(주)", "㈜", "주식회사"]:
        s = s.replace(rm, "")
    s = re.sub(r'\([^)]*\)', '', s)
    return s.strip().rstrip(",").strip()


def _name_score(a: str | None, b: str | None) -> int:
    """Name similarity 0-25."""
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb: return 0
    if na == nb: return 25
    if na in nb or nb in na: return 20
    ta, tb = set(na.split()), set(nb.split())
    if not ta or not tb: return 0
    overlap = len(ta & tb) / len(ta | tb)
    first_a = na.split()[0] if na.split() else ""
    first_b = nb.split()[0] if nb.split() else ""
    if first_a and first_b and (first_a == first_b or first_a in first_b or first_b in first_a):
        return max(int(overlap * 25), 15)
    return int(overlap * 25)


class ClaimCandidate(BaseModel):
    claim_id: int
    account_name: str | None
    reinsurer: str | None
    cedant: str | None
    line: str | None
    ref_no: str | None
    krw_amount: float | None
    status: str | None
    dol: str | None
    score: int
    signals: list[str]


@router.get("/{contract_id}/claim-candidates", response_model=list[ClaimCandidate])
async def get_claim_candidates(
    contract_id: int,
    min_score: int = Query(30, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Pre-filter: at least same reinsurer OR same cedant
    query = select(Claim).where(
        (Claim.reinsurer == contract.reinsurer) | (Claim.cedant == contract.cedant)
    )
    claims = (await db.execute(query)).scalars().all()

    candidates = []
    for cl in claims:
        score = 0
        signals = []

        # Reinsurer match (+30)
        if cl.reinsurer and contract.reinsurer and cl.reinsurer == contract.reinsurer:
            score += 30
            signals.append(f"reinsurer={cl.reinsurer}")

        # Cedant match (+20)
        if cl.cedant and contract.cedant and cl.cedant == contract.cedant:
            score += 20
            signals.append(f"cedant={cl.cedant}")

        # Name similarity (+0~25)
        ns = _name_score(contract.assured, cl.account_name)
        if ns > 0:
            score += ns
            signals.append(f"name={ns}pt")

        # Line match (+15)
        if cl.line and contract.line and (
            cl.line.lower() == contract.line.lower()
            or cl.line.lower() in contract.line.lower()
            or contract.line.lower() in cl.line.lower()
        ):
            score += 15
            signals.append(f"line={cl.line}")

        # DOL within contract period (+10)
        if cl.dol and contract.period_from and contract.period_to:
            if contract.period_from <= cl.dol <= contract.period_to:
                score += 10
                signals.append("dol_in_period")

        if score >= min_score:
            candidates.append(ClaimCandidate(
                claim_id=cl.id,
                account_name=cl.account_name,
                reinsurer=cl.reinsurer,
                cedant=cl.cedant,
                line=cl.line,
                ref_no=cl.ref_no,
                krw_amount=float(cl.krw_amount) if cl.krw_amount else None,
                status=cl.status,
                dol=str(cl.dol) if cl.dol else None,
                score=score,
                signals=signals,
            ))

    candidates.sort(key=lambda x: -x.score)
    return candidates[:50]


# --- AI-powered matching: analyze + save ---

class LinkOut(BaseModel):
    id: int
    contract_id: int
    claim_id: int
    score: int
    signals: list[str] | None
    ai_reasoning: str | None
    status: str
    account_name: str | None = None
    reinsurer: str | None = None
    ref_no: str | None = None
    krw_amount: float | None = None

    class Config:
        from_attributes = True


@router.post("/{contract_id}/match", response_model=list[LinkOut])
async def run_ai_matching(contract_id: int, db: AsyncSession = Depends(get_db)):
    """Score candidates, call Gemini to reason, save to contract_claim_links."""
    from app.models.contract_claim_link import ContractClaimLink
    from sqlalchemy import text as sql_text
    import json
    import google.generativeai as genai
    from app.config import settings

    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Delete old links for this contract
    await db.execute(sql_text("DELETE FROM contract_claim_links WHERE contract_id = :cid"), {"cid": contract_id})
    await db.commit()

    # Get rule-based candidates (score >= 30)
    query = select(Claim).where(
        (Claim.reinsurer == contract.reinsurer) | (Claim.cedant == contract.cedant)
    )
    all_claims = (await db.execute(query)).scalars().all()

    scored = []
    for cl in all_claims:
        score = 0
        signals = []
        if cl.reinsurer and contract.reinsurer and cl.reinsurer == contract.reinsurer:
            score += 30; signals.append(f"reinsurer={cl.reinsurer}")
        if cl.cedant and contract.cedant and cl.cedant == contract.cedant:
            score += 20; signals.append(f"cedant={cl.cedant}")
        ns = _name_score(contract.assured, cl.account_name)
        if ns > 0: score += ns; signals.append(f"name={ns}pt")
        if cl.line and contract.line and (cl.line.lower() in contract.line.lower() or contract.line.lower() in cl.line.lower()):
            score += 15; signals.append(f"line={cl.line}")
        if cl.dol and contract.period_from and contract.period_to:
            if contract.period_from <= cl.dol <= contract.period_to:
                score += 10; signals.append("dol_in_period")
        if score >= 30:
            scored.append({"claim": cl, "score": score, "signals": signals})

    scored.sort(key=lambda x: -x["score"])
    top = scored[:20]

    if not top:
        return []

    # Call Gemini to analyze top candidates
    contract_info = f"Contract #{contract.id}: assured={contract.assured}, reinsurer={contract.reinsurer}, cedant={contract.cedant}, line={contract.line}, period={contract.period_from}~{contract.period_to}, premium={contract.ri_prem}"

    candidates_text = "\n".join([
        f"  Claim #{c['claim'].id}: account={c['claim'].account_name}, reinsurer={c['claim'].reinsurer}, cedant={c['claim'].cedant}, line={c['claim'].line}, ref={c['claim'].ref_no}, krw={c['claim'].krw_amount}, dol={c['claim'].dol}, score={c['score']}, signals={c['signals']}"
        for c in top
    ])

    prompt = f"""You are a reinsurance settlement analyst. Given a contract and claim candidates, analyze each candidate and provide:
1. Whether it's likely a match (yes/maybe/no)
2. Adjusted score (0-100)
3. Brief reasoning in Korean

Contract:
{contract_info}

Candidates:
{candidates_text}

Respond as JSON array: [{{"claim_id": N, "match": "yes/maybe/no", "adjusted_score": N, "reasoning": "..."}}]
Only return the JSON array, no other text."""

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-3.1-flash-lite")

    ai_results = {}
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```"): text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        parsed = json.loads(text)
        for item in parsed:
            ai_results[item["claim_id"]] = item
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"AI matching failed: {e}")

    # Save links
    links = []
    for c in top:
        cl = c["claim"]
        ai = ai_results.get(cl.id, {})
        final_score = ai.get("adjusted_score", c["score"])
        reasoning = ai.get("reasoning")
        match_status = ai.get("match", "maybe")

        if match_status == "no" and final_score < 30:
            continue

        link = ContractClaimLink(
            contract_id=contract_id,
            claim_id=cl.id,
            score=final_score,
            signals=c["signals"],
            ai_reasoning=reasoning,
            status="candidate" if match_status == "maybe" else ("confirmed" if match_status == "yes" else "candidate"),
        )
        db.add(link)
        links.append((link, cl))

    await db.commit()

    result_out = []
    for link, cl in links:
        await db.refresh(link)
        result_out.append(LinkOut(
            id=link.id,
            contract_id=link.contract_id,
            claim_id=link.claim_id,
            score=link.score,
            signals=link.signals,
            ai_reasoning=link.ai_reasoning,
            status=link.status,
            account_name=cl.account_name,
            reinsurer=cl.reinsurer,
            ref_no=cl.ref_no,
            krw_amount=float(cl.krw_amount) if cl.krw_amount else None,
        ))

    result_out.sort(key=lambda x: -x.score)
    return result_out


@router.get("/{contract_id}/links", response_model=list[LinkOut])
async def get_saved_links(contract_id: int, db: AsyncSession = Depends(get_db)):
    """Get previously saved match results."""
    from app.models.contract_claim_link import ContractClaimLink
    links = (await db.execute(
        select(ContractClaimLink).where(ContractClaimLink.contract_id == contract_id).order_by(ContractClaimLink.score.desc())
    )).scalars().all()

    result = []
    for link in links:
        cl = (await db.execute(select(Claim).where(Claim.id == link.claim_id))).scalar_one_or_none()
        result.append(LinkOut(
            id=link.id,
            contract_id=link.contract_id,
            claim_id=link.claim_id,
            score=link.score,
            signals=link.signals,
            ai_reasoning=link.ai_reasoning,
            status=link.status,
            account_name=cl.account_name if cl else None,
            reinsurer=cl.reinsurer if cl else None,
            ref_no=cl.ref_no if cl else None,
            krw_amount=float(cl.krw_amount) if cl and cl.krw_amount else None,
        ))
    return result


@router.put("/{contract_id}/links/{link_id}/status")
async def update_link_status(contract_id: int, link_id: int, status: str = Query(..., enum=["confirmed", "rejected", "candidate"]), db: AsyncSession = Depends(get_db)):
    """Confirm or reject a match candidate."""
    from app.models.contract_claim_link import ContractClaimLink
    link = (await db.execute(
        select(ContractClaimLink).where(ContractClaimLink.id == link_id, ContractClaimLink.contract_id == contract_id)
    )).scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    link.status = status
    await db.commit()
    return {"status": status}


@router.get("", response_model=ContractListResponse)
async def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    year: int | None = None,
    line: str | None = None,
    reinsurer: str | None = None,
    cedant: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Contract)
    count_query = select(func.count(Contract.id))

    if year:
        query = query.where(Contract.year == year)
        count_query = count_query.where(Contract.year == year)
    if line:
        query = query.where(Contract.line == line)
        count_query = count_query.where(Contract.line == line)
    if reinsurer:
        query = query.where(Contract.reinsurer == reinsurer)
        count_query = count_query.where(Contract.reinsurer == reinsurer)
    if cedant:
        query = query.where(Contract.cedant == cedant)
        count_query = count_query.where(Contract.cedant == cedant)
    if search:
        query = query.where(Contract.assured.ilike(f"%{search}%"))
        count_query = count_query.where(Contract.assured.ilike(f"%{search}%"))

    total = (await db.execute(count_query)).scalar()
    items = (
        await db.execute(
            query.order_by(Contract.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return ContractListResponse(
        items=[ContractOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return ContractOut.model_validate(contract)


@router.post("", response_model=ContractOut, status_code=201)
async def create_contract(data: ContractCreate, db: AsyncSession = Depends(get_db)):
    contract = Contract(**data.model_dump(exclude_none=True), company_id=1)
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    await log_change(db, "contracts", contract.id, "create", changes=data.model_dump(exclude_none=True), actor_type="human")
    await db.commit()
    return ContractOut.model_validate(contract)


@router.put("/{contract_id}", response_model=ContractOut)
async def update_contract(contract_id: int, data: ContractUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    old_values = {}
    for key, val in data.model_dump(exclude_none=True).items():
        old_val = getattr(contract, key, None)
        if old_val != val:
            old_values[key] = {"old": str(old_val) if old_val is not None else None, "new": str(val)}
        setattr(contract, key, val)
    await db.commit()
    await db.refresh(contract)
    if old_values:
        await log_change(db, "contracts", contract.id, "update", changes=old_values, actor_type="human")
        await db.commit()
    return ContractOut.model_validate(contract)


@router.delete("/{contract_id}")
async def delete_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    await log_change(db, "contracts", contract.id, "delete", actor_type="human")
    await db.commit()
    await db.delete(contract)
    await db.commit()
    return {"status": "deleted"}
