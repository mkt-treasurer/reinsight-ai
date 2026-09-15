"""Auto-generate policies from contracts and link claims."""

import re
import logging
import json
from collections import defaultdict

import google.generativeai as genai
from sqlalchemy import select, func, distinct, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.contract import Contract
from app.models.claim import Claim
from app.models.policy import Policy, PolicyClaimLink

logger = logging.getLogger(__name__)


def _normalize(s: str | None) -> str:
    if not s: return ""
    s = s.strip().lower()
    for rm in ["co.,ltd", "co., ltd", "inc.", "inc", "corp.", "corp", "ltd.", "ltd", "(주)", "㈜"]:
        s = s.replace(rm, "")
    s = re.sub(r'\([^)]*\)', '', s)
    return s.strip()


async def build_policies(db: AsyncSession) -> dict:
    """Generate Policy records from contracts grouped by cover_note_no."""
    # Clear existing
    await db.execute(text("DELETE FROM policy_claim_links"))
    await db.execute(text("DELETE FROM policy_documents"))
    await db.execute(text("DELETE FROM policies"))
    await db.commit()

    # Group contracts by cover_note_no
    contracts = (await db.execute(select(Contract).where(Contract.cover_note_no.isnot(None)))).scalars().all()

    groups: dict[str, list[Contract]] = defaultdict(list)
    for c in contracts:
        groups[c.cover_note_no.strip()].append(c)

    count = 0
    for cn_no, grp in groups.items():
        policy = Policy(
            company_id=grp[0].company_id,
            cover_note_no=cn_no,
            assured=grp[0].assured,
            line=grp[0].line,
            cedant=grp[0].cedant,
            period_from=min((c.period_from for c in grp if c.period_from), default=None),
            period_to=max((c.period_to for c in grp if c.period_to), default=None),
            currency=grp[0].currency,
            total_premium=sum(float(c.ri_prem or 0) for c in grp),
            reinsurer_count=len(set(c.reinsurer for c in grp if c.reinsurer)),
            contract_count=len(grp),
        )
        db.add(policy)
        count += 1

    await db.commit()
    logger.info(f"Built {count} policies from contracts")
    return {"policies_created": count}


async def link_claims_to_policies(db: AsyncSession) -> dict:
    """Auto-match claims to policies using reinsurer + cedant + name similarity."""
    policies = (await db.execute(select(Policy))).scalars().all()
    claims = (await db.execute(select(Claim))).scalars().all()

    # Index policies by (reinsurer, cedant) from their contracts
    policy_index: dict[int, dict] = {}
    for p in policies:
        contracts = (await db.execute(
            select(Contract).where(Contract.cover_note_no == p.cover_note_no)
        )).scalars().all()
        reinsurers = set(c.reinsurer for c in contracts if c.reinsurer)
        policy_index[p.id] = {
            "policy": p,
            "reinsurers": reinsurers,
            "assured_norm": _normalize(p.assured),
            "cedant": p.cedant,
            "line": p.line,
            "period_from": p.period_from,
            "period_to": p.period_to,
        }

    linked = 0
    for cl in claims:
        best_policy_id = None
        best_score = 0

        cl_name = _normalize(cl.account_name)

        for pid, pinfo in policy_index.items():
            score = 0

            # Reinsurer match
            if cl.reinsurer in pinfo["reinsurers"]:
                score += 30

            # Cedant match
            if cl.cedant and pinfo["cedant"] and cl.cedant == pinfo["cedant"]:
                score += 20

            # Name match
            pa = pinfo["assured_norm"]
            if pa and cl_name:
                if pa == cl_name:
                    score += 25
                elif pa in cl_name or cl_name in pa:
                    score += 20
                else:
                    ta, tb = set(pa.split()), set(cl_name.split())
                    if ta and tb:
                        overlap = len(ta & tb) / len(ta | tb)
                        score += int(overlap * 15)

            # Line match
            if cl.line and pinfo["line"] and (
                cl.line.lower() in pinfo["line"].lower() or pinfo["line"].lower() in cl.line.lower()
            ):
                score += 10

            # DOL in period
            if cl.dol and pinfo["period_from"] and pinfo["period_to"]:
                if pinfo["period_from"] <= cl.dol <= pinfo["period_to"]:
                    score += 15

            if score > best_score:
                best_score = score
                best_policy_id = pid

        if best_policy_id and best_score >= 50:
            link = PolicyClaimLink(
                policy_id=best_policy_id,
                claim_id=cl.id,
                score=best_score,
                method="auto",
            )
            db.add(link)
            linked += 1

            if linked % 500 == 0:
                await db.flush()

    await db.commit()

    # Update claim counts on policies
    for p in policies:
        count = (await db.execute(
            select(func.count(PolicyClaimLink.id)).where(PolicyClaimLink.policy_id == p.id)
        )).scalar()
        p.claim_count = count
    await db.commit()

    logger.info(f"Linked {linked} claims to policies")
    return {"claims_linked": linked}
