"""Contract intake processing: policy match + draft generation."""

import logging
import re

import google.generativeai as genai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.contract import Contract
from app.models.policy import Policy
from app.models.contract_workflow import ContractCase, ContractDraft

logger = logging.getLogger(__name__)


def _normalize(s):
    if not s: return ""
    s = s.strip().lower()
    for rm in ["co.,ltd", "co., ltd", "inc.", "corp.", "ltd.", "(주)", "㈜"]:
        s = s.replace(rm, "")
    return re.sub(r'\([^)]*\)', '', s).strip()


async def process_contract(case_id: int, db: AsyncSession) -> dict:
    case = (await db.execute(select(ContractCase).where(ContractCase.id == case_id))).scalar_one_or_none()
    if not case:
        return {"error": "Case not found"}

    steps = []
    case.status = "analyzing"
    await db.commit()

    # 1. Find or create policy
    policy = None
    if case.cover_note_no:
        policy = (await db.execute(
            select(Policy).where(Policy.cover_note_no == case.cover_note_no)
        )).scalar_one_or_none()
        if policy:
            steps.append({"step": "policy_found", "policy_id": policy.id, "assured": policy.assured})

    if not policy:
        # Search by name
        policies = (await db.execute(select(Policy))).scalars().all()
        norm = _normalize(case.assured)
        best, best_score = None, 0
        for p in policies:
            score = 0
            pn = _normalize(p.assured)
            if pn == norm: score = 50
            elif pn in norm or norm in pn: score = 40
            if p.cedant and case.cedant and p.cedant == case.cedant: score += 20
            if score > best_score:
                best_score = score
                best = p
        if best and best_score >= 40:
            policy = best
            case.matched_policy_id = policy.id
            steps.append({"step": "policy_matched", "policy_id": policy.id, "assured": policy.assured, "score": best_score})
        else:
            steps.append({"step": "no_policy"})

    # 2. AI summary
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-3.1-flash-lite")
        prompt = f"""재보험 계약 분석 요약 (한국어 2-3문장):
피보험자: {case.assured}, 출재사: {case.cedant}, 종목: {case.line}
커버노트: {case.cover_note_no}, 기간: {case.period_from}~{case.period_to}
보험료: {case.currency} {case.gross_premium}
매칭 Policy: {policy.cover_note_no + ' / ' + policy.assured if policy else '없음'}"""
        resp = model.generate_content(prompt)
        case.ai_summary = resp.text.strip()
        steps.append({"step": "ai_summary", "summary": case.ai_summary})
    except Exception as e:
        case.ai_summary = f"계약 접수: {case.assured} / {case.cover_note_no}"
        steps.append({"step": "ai_summary", "summary": case.ai_summary})

    # 3. Generate drafts (Closing + STMT per reinsurer)
    if policy:
        contracts = (await db.execute(
            select(Contract).where(Contract.cover_note_no == policy.cover_note_no).where(Contract.share > 0)
        )).scalars().all()

        if not contracts:
            # No existing splits — create a single draft
            draft = ContractDraft(
                case_id=case.id, reinsurer="TBD", share=1.0,
                ri_premium=float(case.gross_premium or 0),
                doc_type="closing",
                subject=f"Closing - {case.assured} / {case.cover_note_no or 'New'}",
                body=_gen_closing_body(case, "TBD", 1.0, float(case.gross_premium or 0)),
            )
            db.add(draft)
            steps.append({"step": "drafts_generated", "count": 1})
        else:
            count = 0
            for c in contracts:
                share = float(c.share or 0)
                ri_prem = float(case.gross_premium or 0) * share
                comm = ri_prem * 0.2  # default 20% commission
                net = ri_prem - comm

                # Closing draft
                db.add(ContractDraft(
                    case_id=case.id, reinsurer=c.reinsurer, share=share,
                    ri_premium=ri_prem, commission=comm, net_premium=net,
                    doc_type="closing",
                    subject=f"Closing - {case.assured} / {case.cover_note_no or 'New'} / {c.reinsurer}",
                    body=_gen_closing_body(case, c.reinsurer, share, ri_prem),
                ))
                count += 1

            # Also create contract records
            for c in contracts:
                share = float(c.share or 0)
                ri_prem = float(case.gross_premium or 0) * share
                new_contract = Contract(
                    company_id=case.company_id, year=2026,
                    cover_note_no=case.cover_note_no, assured=case.assured,
                    line=case.line, cedant=case.cedant,
                    reinsurer=c.reinsurer, share=c.share,
                    currency=case.currency,
                    gross_prem_100=case.gross_premium,
                    ri_prem=ri_prem,
                    workflow_status="draft_ready",
                )
                db.add(new_contract)

            steps.append({"step": "drafts_generated", "count": count})

        case.status = "draft_ready"
    else:
        case.status = "analyzed"

    await db.commit()
    return {"case_id": case_id, "status": case.status, "steps": steps}


def _gen_closing_body(case, reinsurer, share, ri_prem):
    ccy = case.currency or "KRW"
    return f"""FACULTATIVE REINSURANCE CLOSING

Intermediary              : INS Corp.
                            15F The Exchange Seoul Building
                            Mugyo-ro, Jung-gu, Seoul, Korea

Reinsurer                 : {reinsurer}
Insured                   : {case.assured}
Cedant                    : {case.cedant or 'N/A'}
Line of Business          : {case.line or 'N/A'}
Cover Note                : {case.cover_note_no or 'TBD'}
Period                    : {case.period_from or 'TBD'} to {case.period_to or 'TBD'}

PREMIUM
Gross Premium (100%)      : {ccy} {float(case.gross_premium or 0):>20,.0f}
Your Share                : {share * 100:.2f}%
Your Premium              : {ccy} {ri_prem:>20,.0f}

Payment due within 120 days from inception.

Signed for and on behalf of:
INS Corp."""
