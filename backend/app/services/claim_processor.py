"""AI-powered claim intake and processing pipeline."""

import json
import logging
import re
from datetime import datetime

import google.generativeai as genai
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.claim import Claim
from app.models.contract import Contract
from app.models.policy import Policy, PolicyClaimLink
from app.models.claim_workflow import ClaimCase, ClaimDraft

logger = logging.getLogger(__name__)


def _normalize(s: str | None) -> str:
    if not s: return ""
    s = s.strip().lower()
    for rm in ["co.,ltd", "co., ltd", "inc.", "corp.", "ltd.", "(주)", "㈜"]:
        s = s.replace(rm, "")
    return re.sub(r'\([^)]*\)', '', s).strip()


async def process_claim(case_id: int, db: AsyncSession) -> dict:
    """Run the full AI pipeline on a claim case."""
    case = (await db.execute(select(ClaimCase).where(ClaimCase.id == case_id))).scalar_one_or_none()
    if not case:
        return {"error": "Case not found"}

    steps = []

    # Step 1: Find matching policy
    case.status = "analyzing"
    await db.commit()

    policy, policy_score = await _find_policy(case, db)
    if policy:
        case.matched_policy_id = policy.id
        steps.append({"step": "policy_match", "policy_id": policy.id, "assured": policy.assured, "score": policy_score})
    else:
        steps.append({"step": "policy_match", "result": "no_match"})

    # Step 2: Check duplicates
    dupes = await _check_duplicates(case, db)
    case.duplicate_check = dupes
    steps.append({"step": "duplicate_check", **dupes})

    # Step 3: Generate AI summary
    summary = await _generate_summary(case, policy, dupes)
    case.ai_summary = summary
    steps.append({"step": "ai_summary", "summary": summary})

    # Step 4: Generate drafts + create claim records
    if policy:
        drafts = await _generate_drafts(case, policy, db)
        claim_ids = await _create_claim_records(case, policy, db)
        case.status = "draft_ready"
        steps.append({"step": "drafts_generated", "count": len(drafts), "claims_created": len(claim_ids)})
    else:
        case.status = "analyzed"
        steps.append({"step": "no_drafts", "reason": "no policy matched"})

    await db.commit()
    return {"case_id": case_id, "status": case.status, "steps": steps}


async def _find_policy(case: ClaimCase, db: AsyncSession) -> tuple:
    """Find the best matching policy for this claim. Only policies with valid contracts (share > 0)."""
    policies = (await db.execute(select(Policy))).scalars().all()
    norm_account = _normalize(case.account_name)

    # Pre-filter: only policies that have contracts with share
    valid_policies = []
    for p in policies:
        has_valid = (await db.execute(
            select(Contract.id).where(
                Contract.cover_note_no == p.cover_note_no,
                Contract.share.isnot(None), Contract.share > 0
            ).limit(1)
        )).scalar_one_or_none()
        if has_valid:
            valid_policies.append(p)

    best = None
    best_score = 0

    for p in valid_policies:
        score = 0
        norm_assured = _normalize(p.assured)

        # Name match
        if norm_assured and norm_account:
            if norm_assured == norm_account:
                score += 40
            elif norm_assured in norm_account or norm_account in norm_assured:
                score += 30
            else:
                ta = set(norm_assured.split())
                tb = set(norm_account.split())
                if ta and tb:
                    overlap = len(ta & tb) / len(ta | tb)
                    score += int(overlap * 25)

        # Cedant match
        if case.cedant and p.cedant and case.cedant == p.cedant:
            score += 20

        # Line match
        if case.line and p.line and (case.line.lower() in p.line.lower() or p.line.lower() in case.line.lower()):
            score += 15

        if score > best_score:
            best_score = score
            best = p

    return (best, best_score) if best_score >= 30 else (None, 0)


async def _check_duplicates(case: ClaimCase, db: AsyncSession) -> dict:
    """Check if similar claims already exist."""
    similar = []

    # Check by ref_no
    if case.ref_no:
        existing = (await db.execute(
            select(Claim).where(Claim.ref_no == case.ref_no)
        )).scalars().all()
        for cl in existing:
            similar.append({
                "claim_id": cl.id, "ref_no": cl.ref_no,
                "account_name": cl.account_name, "reinsurer": cl.reinsurer,
                "krw_amount": float(cl.krw_amount) if cl.krw_amount else None,
                "match_reason": "same_ref_no",
            })

    # Check by account_name + similar amount
    if case.account_name and case.total_amount:
        amt = float(case.total_amount)
        existing = (await db.execute(
            select(Claim).where(
                Claim.account_name.ilike(f"%{case.account_name[:20]}%")
            ).limit(50)
        )).scalars().all()
        for cl in existing:
            if cl.krw_amount and abs(float(cl.krw_amount) - amt) / max(abs(amt), 1) < 0.01:
                if not any(s["claim_id"] == cl.id for s in similar):
                    similar.append({
                        "claim_id": cl.id, "ref_no": cl.ref_no,
                        "account_name": cl.account_name, "reinsurer": cl.reinsurer,
                        "krw_amount": float(cl.krw_amount),
                        "match_reason": "same_account_similar_amount",
                    })

    return {
        "is_duplicate": len(similar) > 0,
        "similar_count": len(similar),
        "similar_claims": similar[:10],
    }


async def _generate_summary(case: ClaimCase, policy, dupes: dict) -> str:
    """Use Gemini to generate a Korean summary of the claim analysis."""
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-3.1-flash-lite")

        prompt = f"""재보험 클레임 분석 요약을 한국어로 작성하세요.

클레임 정보:
- 계정: {case.account_name}
- 출재사: {case.cedant}
- 종목: {case.line}
- Ref No: {case.ref_no}
- 사고일: {case.dol}
- 금액: {case.total_amount} {case.currency}

매칭 Policy: {f"{policy.cover_note_no} / {policy.assured}" if policy else "없음"}
중복 여부: {"중복 의심 " + str(dupes["similar_count"]) + "건" if dupes["is_duplicate"] else "중복 없음"}

2-3문장으로 간결하게 요약. 주의사항이 있으면 포함."""

        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        return f"클레임 접수: {case.account_name} / {case.ref_no}"


async def _generate_drafts(case: ClaimCase, policy: Policy, db: AsyncSession) -> list[ClaimDraft]:
    """Generate SOC drafts for each reinsurer on the policy."""
    contracts = (await db.execute(
        select(Contract).where(Contract.cover_note_no == policy.cover_note_no)
    )).scalars().all()

    drafts = []
    for c in contracts:
        if not c.reinsurer or not c.share:
            continue

        share = float(c.share)
        amount = float(case.total_amount or 0) * share

        subject = f"SOC - {case.account_name} / {case.ref_no or 'New'} / {c.reinsurer}"
        ccy = case.currency or "KRW"
        total = float(case.total_amount or 0)

        body = f"""SETTLEMENT OF CLAIM

Intermediary              : INS Corp. Innovation & Solutions
                            15F The Exchange Seoul Building No.21
                            Mugyo-ro, Jung-gu, Seoul, 04520, Korea

Reinsurance Type          : Proportional Facultative Reinsurance
Policy Reference          : {policy.cover_note_no}

Insured                   : {case.account_name}
Reinsured                 : {c.cedant or policy.cedant or 'N/A'}
Period of Insurance       : {policy.period_from or 'N/A'} to {policy.period_to or 'N/A'}
Line of Business          : {case.line or policy.line or 'N/A'}

CLAIM DETAILS
Reference No.             : {case.ref_no or 'TBD'}
Date of Loss              : {case.dol or 'TBD'}
Description               : {case.description or 'As per original loss advice'}

SETTLEMENT AMOUNT
Gross Claim Amount        : {ccy} {total:>20,.0f}
Your Participation        : {share * 100:.2f}%
Your Share of Claim       : {ccy} {amount:>20,.0f}

REINSURER
{c.reinsurer}
Order hereon              : {share * 100:.2f}% of 100%

PAYMENT INSTRUCTIONS
Please remit the above amount to:
Bank: [To be advised]
Account: [To be advised]
Reference: {case.ref_no or 'TBD'} / {c.reinsurer}

INTERMEDIARY CLAUSE
INS Corp. Innovation & Solutions is recognized as the Intermediary
negotiating this Contract. All communications relating thereto shall
be transmitted through the Intermediary.

Signed for and on behalf of the Intermediary:

_______________________________
INS Corp. Innovation & Solutions
Date: _______________"""

        draft = ClaimDraft(
            case_id=case.id,
            reinsurer=c.reinsurer,
            share=share,
            amount=amount,
            currency=case.currency or "KRW",
            subject=subject,
            body=body,
        )
        db.add(draft)
        drafts.append(draft)

    await db.flush()
    return drafts


async def _create_claim_records(case: ClaimCase, policy: Policy, db: AsyncSession) -> list[int]:
    """Create actual Claim records in the claims table (one per reinsurer)."""
    from datetime import datetime as dt

    contracts = (await db.execute(
        select(Contract).where(Contract.cover_note_no == policy.cover_note_no)
    )).scalars().all()

    claim_ids = []
    for c in contracts:
        if not c.reinsurer or not c.share:
            continue

        share = float(c.share)
        amount = float(case.total_amount or 0) * share

        # Parse DOL
        dol_date = None
        if case.dol:
            try:
                dol_date = dt.strptime(case.dol, "%Y-%m-%d").date()
            except ValueError:
                pass

        claim = Claim(
            company_id=case.company_id,
            account_name=case.account_name,
            line=case.line or policy.line,
            reinsurer=c.reinsurer,
            cedant=c.cedant or policy.cedant,
            currency=case.currency or "KRW",
            total_amount=case.total_amount,
            share=c.share,
            krw_amount=amount,
            ref_no=case.ref_no,
            dol=dol_date,
            status="Open",
            workflow_status="draft_ready",
            case_id=case.id,
            remarks=case.description,
        )
        db.add(claim)
        await db.flush()
        claim_ids.append(claim.id)

    logger.info(f"Created {len(claim_ids)} claim records for case {case.id}")
    return claim_ids
