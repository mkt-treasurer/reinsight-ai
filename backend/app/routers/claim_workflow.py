from datetime import datetime as dt
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.claim_workflow import ClaimCase, ClaimDraft
from app.models.policy import Policy
from app.services.claim_processor import process_claim

router = APIRouter(prefix="/api/claim-cases", tags=["claim_workflow"])


class CaseCreate(BaseModel):
    account_name: str
    cedant: str | None = None
    line: str | None = None
    ref_no: str | None = None
    dol: str | None = None
    currency: str | None = "KRW"
    total_amount: float | None = None
    description: str | None = None


class CaseOut(BaseModel):
    id: int
    account_name: str | None
    cedant: str | None
    line: str | None
    ref_no: str | None
    dol: str | None
    currency: str | None
    total_amount: float | None
    description: str | None
    matched_policy_id: int | None
    duplicate_check: dict | None
    ai_summary: str | None
    status: str
    assigned_to: str | None
    created_at: dt | None = None
    sent_at: dt | None = None
    paid_at: dt | None = None

    class Config:
        from_attributes = True


class DraftOut(BaseModel):
    id: int
    case_id: int
    reinsurer: str | None
    share: float | None
    amount: float | None
    currency: str | None
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


class PipelineSummary(BaseModel):
    intake: int
    analyzing: int
    analyzed: int
    draft_ready: int
    review: int
    sent: int
    awaiting_payment: int
    completed: int


# --- Parse email/msg endpoint ---

@router.post("/parse-email")
async def parse_email_input(
    email_text: str | None = None,
    msg_file: UploadFile | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Parse email content or .msg file, extract claim data with Gemini."""
    import json
    import google.generativeai as genai
    from app.config import settings

    content = ""

    if msg_file:
        import tempfile, extract_msg
        with tempfile.NamedTemporaryFile(suffix=".msg", delete=False) as f:
            f.write(await msg_file.read())
            f.flush()
            try:
                msg = extract_msg.Message(f.name)
                parts = []
                if msg.subject: parts.append(f"Subject: {msg.subject}")
                if msg.sender: parts.append(f"From: {msg.sender}")
                if msg.to: parts.append(f"To: {msg.to}")
                if msg.date: parts.append(f"Date: {msg.date}")
                if msg.body: parts.append(f"\n{msg.body[:3000]}")
                content = "\n".join(parts)
                msg.close()
            except Exception as e:
                return {"error": f"MSG parse failed: {str(e)}"}
    elif email_text:
        content = email_text[:4000]
    else:
        return {"error": "Provide email_text or msg_file"}

    # Use Gemini to extract claim data
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-3.1-flash-lite")

    prompt = f"""Extract reinsurance claim information from this email. Return JSON:
{{
  "account_name": "피보험자/insured name",
  "cedant": "출재사/reinsured",
  "line": "보험종목 (Property/Casualty/Marine/Engineering/CAR/EAR etc)",
  "ref_no": "참조번호/reference number",
  "dol": "사고일/date of loss (YYYY-MM-DD if found)",
  "currency": "통화 (KRW/USD/EUR etc)",
  "total_amount": number or null,
  "description": "사고 내용 요약 (Korean, 1 sentence)"
}}

Email content:
{content}

Return only JSON."""

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
            raw = raw.strip()
        extracted = json.loads(raw)
        extracted["_raw_content"] = content[:500]
        return extracted
    except Exception as e:
        return {"error": f"AI extraction failed: {str(e)}", "_raw_content": content[:500]}


@router.get("/demo-data")
async def get_demo_data():
    """Return sample claim data with actual file references."""
    return [
        {
            "account_name": "SAMSUNG SDI CO.,LTD",
            "cedant": "SS",
            "line": "PL",
            "ref_no": "20250814-56389-01",
            "dol": "2025-08-07",
            "currency": "KRW",
            "total_amount": 520000000,
            "description": "Samsung SDI 제조물책임 클레임",
            "files": [
                {"name": "PLA_Samsung SDI_PL_UY2025.pdf", "path": "보험금/2026년 3월/3.19/PLA/SAMSUNG SDI CO.,LTD/PLA_Samsung SDI_PL_UY2025(DOL 2025-08-07)_20250814-56389-01 (13) (QBE SG).pdf"},
                {"name": "SamSungFire_원수사통보.pdf", "path": "보험금/2026년 3월/3.19/PLA/SAMSUNG SDI CO.,LTD/SamSungFire_oz_20260319_023112324.pdf"},
                {"name": "PLA_Samsung SDI_PL_UY2025.xlsx", "path": "보험금/2026년 3월/3.19/PLA/SAMSUNG SDI CO.,LTD/PLA_Samsung SDI_PL_UY2025(DOL 2025-08-07)_20250814-56389-01 (13) (QBE SG).xlsx"},
            ]
        },
        {
            "account_name": "Nonghyup Hansamin.Co., Ltd",
            "cedant": "KR",
            "line": "PAR",
            "ref_no": "C2020023652109-1-43",
            "dol": "2019-10-14",
            "currency": "KRW",
            "total_amount": 85000000,
            "description": "농협한사민 재산종합 화재사고 SOC",
            "files": [
                {"name": "SOC_Nonghyup Hansamin (MSIG).pdf", "path": "보험금/2026년 3월/3.26/SOC/Nonghyup Hansamin.Co., Ltd/C2020023652109-1-43/SOC_Nonghyup Hansamin_PAR_UY2019(DOL 2019-10-14)_C2020023652109-1-43 (MSIG).pdf"},
                {"name": "SETTLEMENT OF CLAIM.pdf", "path": "보험금/2026년 3월/3.26/SOC/Nonghyup Hansamin.Co., Ltd/C2020023652109-1-43/SETTLEMENT OF CLAIM 202603261059259078242.pdf"},
                {"name": "SOC_Nonghyup Hansamin.xlsx", "path": "보험금/2026년 3월/3.26/SOC/Nonghyup Hansamin.Co., Ltd/C2020023652109-1-43/SOC_Nonghyup Hansamin_PAR_UY2019(DOL 2019-10-14)_C2020023652109-1-43.xlsx"},
            ]
        },
        {
            "account_name": "Kumho Petrochemical Co., Ltd",
            "cedant": "KR",
            "line": "PAR",
            "ref_no": "C2026031599001-1-1",
            "dol": "2026-02-15",
            "currency": "KRW",
            "total_amount": 250000000,
            "description": "여수 공장 화재로 인한 재산피해",
            "files": []
        },
    ]


# --- Endpoints ---

@router.get("/pipeline", response_model=PipelineSummary)
async def get_pipeline(db: AsyncSession = Depends(get_db)):
    statuses = ["intake", "analyzing", "analyzed", "draft_ready", "review", "sent", "awaiting_payment", "completed"]
    counts = {}
    for s in statuses:
        counts[s] = (await db.execute(
            select(func.count(ClaimCase.id)).where(ClaimCase.status == s).where((ClaimCase.is_deleted == False) | (ClaimCase.is_deleted.is_(None)))
        )).scalar() or 0
    return PipelineSummary(**counts)


@router.post("", response_model=CaseOut, status_code=201)
async def create_case(data: CaseCreate, db: AsyncSession = Depends(get_db)):
    case = ClaimCase(**data.model_dump(), company_id=1)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return CaseOut.model_validate(case)


@router.post("/{case_id}/process")
async def trigger_process(case_id: int, db: AsyncSession = Depends(get_db)):
    """Run AI analysis pipeline on a claim case."""
    return await process_claim(case_id, db)


@router.get("", response_model=list[CaseOut])
async def list_cases(
    status: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
):
    query = select(ClaimCase).order_by(ClaimCase.id.desc())
    if not include_deleted:
        query = query.where((ClaimCase.is_deleted == False) | (ClaimCase.is_deleted.is_(None)))
    if status:
        query = query.where(ClaimCase.status == status)
    cases = (await db.execute(query.limit(100))).scalars().all()
    return [CaseOut.model_validate(c) for c in cases]


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case(case_id: int, db: AsyncSession = Depends(get_db)):
    case = (await db.execute(select(ClaimCase).where(ClaimCase.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    drafts = (await db.execute(
        select(ClaimDraft).where(ClaimDraft.case_id == case_id).order_by(ClaimDraft.amount.desc())
    )).scalars().all()

    policy_assured = None
    policy_cover_note = None
    if case.matched_policy_id:
        policy = (await db.execute(select(Policy).where(Policy.id == case.matched_policy_id))).scalar_one_or_none()
        if policy:
            policy_assured = policy.assured
            policy_cover_note = policy.cover_note_no

    base = CaseOut.model_validate(case)
    return CaseDetail(
        **base.model_dump(),
        drafts=[DraftOut.model_validate(d) for d in drafts],
        policy_assured=policy_assured,
        policy_cover_note=policy_cover_note,
    )


@router.put("/{case_id}/drafts/{draft_id}", response_model=DraftOut)
async def update_draft(case_id: int, draft_id: int, subject: str | None = None, body: str | None = None, db: AsyncSession = Depends(get_db)):
    draft = (await db.execute(
        select(ClaimDraft).where(ClaimDraft.id == draft_id, ClaimDraft.case_id == case_id)
    )).scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if subject is not None:
        draft.subject = subject
    if body is not None:
        draft.body = body
    await db.commit()
    await db.refresh(draft)
    return DraftOut.model_validate(draft)


@router.post("/{case_id}/send")
async def send_drafts(case_id: int, db: AsyncSession = Depends(get_db)):
    """Mock send all drafts to reinsurers. Also updates linked claims."""
    from app.models.claim import Claim

    case = (await db.execute(select(ClaimCase).where(ClaimCase.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    drafts = (await db.execute(
        select(ClaimDraft).where(ClaimDraft.case_id == case_id, ClaimDraft.status == "draft")
    )).scalars().all()

    now = dt.utcnow()
    for d in drafts:
        d.status = "sent"
        d.sent_at = now

    case.status = "sent"
    case.sent_at = now

    # Update linked claims
    linked_claims = (await db.execute(
        select(Claim).where(Claim.case_id == case_id)
    )).scalars().all()
    for cl in linked_claims:
        cl.workflow_status = "sent_to_reinsurer"
        cl.soc_sent = str(now.date())

    await db.commit()
    return {"sent_count": len(drafts), "status": "sent"}


@router.post("/{case_id}/mark-paid")
async def mark_paid(case_id: int, draft_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Mark a draft or entire case as paid."""
    case = (await db.execute(select(ClaimCase).where(ClaimCase.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    now = dt.utcnow()

    if draft_id:
        draft = (await db.execute(
            select(ClaimDraft).where(ClaimDraft.id == draft_id, ClaimDraft.case_id == case_id)
        )).scalar_one_or_none()
        if draft:
            draft.status = "paid"
            draft.paid_at = now
    else:
        drafts = (await db.execute(
            select(ClaimDraft).where(ClaimDraft.case_id == case_id)
        )).scalars().all()
        for d in drafts:
            d.status = "paid"
            d.paid_at = now

    # Check if all drafts are paid
    all_drafts = (await db.execute(
        select(ClaimDraft).where(ClaimDraft.case_id == case_id)
    )).scalars().all()
    if all(d.status == "paid" for d in all_drafts):
        case.status = "completed"
        case.paid_at = now
    else:
        case.status = "awaiting_payment"

    # Update linked claims
    from app.models.claim import Claim
    linked_claims = (await db.execute(
        select(Claim).where(Claim.case_id == case_id)
    )).scalars().all()
    for cl in linked_claims:
        if case.status == "completed":
            cl.workflow_status = "completed"
            cl.status = "Closed"
            cl.paid_date = now.date()
        else:
            cl.workflow_status = "payment_received"

    await db.commit()
    return {"status": case.status}


@router.delete("/{case_id}")
async def soft_delete_case(case_id: int, db: AsyncSession = Depends(get_db)):
    """Soft delete — marks as deleted, doesn't remove from DB."""
    case = (await db.execute(select(ClaimCase).where(ClaimCase.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.is_deleted = True
    case.status = "deleted"

    # Also soft-delete linked claims
    from app.models.claim import Claim
    linked = (await db.execute(select(Claim).where(Claim.case_id == case_id))).scalars().all()
    for cl in linked:
        cl.status = "Deleted"
        cl.workflow_status = "deleted"

    await db.commit()
    return {"status": "deleted"}


@router.post("/{case_id}/restore")
async def restore_case(case_id: int, db: AsyncSession = Depends(get_db)):
    """Restore a soft-deleted case."""
    case = (await db.execute(select(ClaimCase).where(ClaimCase.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.is_deleted = False
    case.status = "draft_ready"

    from app.models.claim import Claim
    linked = (await db.execute(select(Claim).where(Claim.case_id == case_id))).scalars().all()
    for cl in linked:
        cl.status = "Open"
        cl.workflow_status = "draft_ready"

    await db.commit()
    return {"status": "restored"}
