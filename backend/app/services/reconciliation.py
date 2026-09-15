"""
Practical reconciliation engine for reinsurance settlement.

Three checks:
  1. SOC Reconciliation — soc_amount vs krw_amount within claims
  2. Cover Note Integrity — cover notes that aren't booked in contracts
  3. Duplicate Detection — same ref_no appearing multiple times
"""

import logging
from collections import defaultdict

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.claim import Claim
from app.models.cover_note import CoverNote
from app.schemas.reconciliation import (
    SocMismatch, SocSummary,
    UnbookedCoverNote, CoverNoteSummary,
    DuplicateGroup, DuplicateSummary,
    ReconciliationResult,
)

logger = logging.getLogger(__name__)


async def _check_soc(db: AsyncSession) -> tuple[SocSummary, list[SocMismatch]]:
    """Check if soc_amount matches krw_amount within each claim record."""
    claims = (await db.execute(select(Claim))).scalars().all()

    exact = 0
    mismatch_list: list[SocMismatch] = []
    soc_missing = 0
    total_diff = 0.0

    for cl in claims:
        krw = float(cl.krw_amount or 0)
        soc = cl.soc_amount

        if soc is None:
            soc_missing += 1
            continue

        soc_f = float(soc)
        if round(krw) == round(soc_f):
            exact += 1
        else:
            diff = krw - soc_f
            total_diff += abs(diff)
            mismatch_list.append(SocMismatch(
                claim_id=cl.id,
                account_name=cl.account_name,
                reinsurer=cl.reinsurer,
                ref_no=cl.ref_no,
                krw_amount=krw,
                soc_amount=soc_f,
                difference=diff,
            ))

    # Sort by absolute difference descending
    mismatch_list.sort(key=lambda x: abs(x.difference or 0), reverse=True)

    summary = SocSummary(
        total=len(claims),
        exact_match=exact,
        mismatch=len(mismatch_list),
        soc_missing=soc_missing,
        mismatch_total_diff=total_diff,
    )

    return summary, mismatch_list[:300]


async def _check_cover_notes(db: AsyncSession) -> tuple[CoverNoteSummary, list[UnbookedCoverNote]]:
    """Check cover notes that don't have corresponding contract bookings."""
    cover_notes = (await db.execute(select(CoverNote))).scalars().all()
    # Get all booked cover note numbers
    booked = set()
    result = await db.execute(
        select(Contract.cover_note_no).where(Contract.cover_note_no.isnot(None))
    )
    for row in result.scalars().all():
        booked.add(row.strip())

    unbooked: list[UnbookedCoverNote] = []
    matched = 0

    seen_numbers = set()
    for cn in cover_notes:
        num = (cn.cover_note_number or "").strip()
        if not num or num in seen_numbers:
            continue
        seen_numbers.add(num)

        if num in booked:
            matched += 1
        else:
            unbooked.append(UnbookedCoverNote(
                cover_note_id=cn.id,
                cover_note_number=num,
                assured=cn.assured,
                line=cn.line,
                issuing_date=str(cn.issuing_date) if cn.issuing_date else None,
            ))

    summary = CoverNoteSummary(
        total_cover_notes=len(seen_numbers),
        matched=matched,
        unbooked=len(unbooked),
    )

    return summary, unbooked[:300]


async def _check_duplicates(db: AsyncSession) -> tuple[DuplicateSummary, list[DuplicateGroup]]:
    """Detect duplicate ref_no entries in claims."""
    claims = (await db.execute(select(Claim).where(Claim.ref_no.isnot(None)))).scalars().all()

    ref_groups: dict[str, list] = defaultdict(list)
    for cl in claims:
        ref = (cl.ref_no or "").strip()
        if not ref:
            continue
        ref_groups[ref].append(cl)

    total_refs = len(ref_groups)
    unique = 0
    duplicate_list: list[DuplicateGroup] = []

    for ref_no, group in ref_groups.items():
        if len(group) == 1:
            unique += 1
            continue

        # Check if these are truly duplicates (same reinsurer = different tranches, OK)
        # vs actual duplicates (same reinsurer + same amount = suspicious)
        reinsurer_amounts = defaultdict(list)
        for cl in group:
            key = (cl.reinsurer or "", round(float(cl.krw_amount or 0)))
            reinsurer_amounts[key].append(cl)

        # Only flag if same (reinsurer, amount) appears more than once
        has_true_duplicate = any(len(v) > 1 for v in reinsurer_amounts.values())

        claim_entries = []
        for cl in group[:10]:
            claim_entries.append({
                "id": cl.id,
                "account_name": cl.account_name,
                "reinsurer": cl.reinsurer,
                "krw_amount": float(cl.krw_amount or 0),
                "booking_month": cl.booking_month,
                "status": cl.status,
                "is_suspicious": has_true_duplicate,
            })

        duplicate_list.append(DuplicateGroup(
            ref_no=ref_no,
            count=len(group),
            claims=claim_entries,
        ))

    # Sort: suspicious first, then by count
    duplicate_list.sort(
        key=lambda x: (-int(any(c.get("is_suspicious") for c in x.claims)), -x.count)
    )

    heavy = sum(1 for d in duplicate_list if d.count > 5)

    summary = DuplicateSummary(
        total_refs=total_refs,
        unique_refs=unique,
        duplicate_refs=len(duplicate_list),
        heavy_duplicates=heavy,
    )

    return summary, duplicate_list[:200]


async def run_reconciliation(db: AsyncSession) -> ReconciliationResult:
    soc_summary, soc_mismatches = await _check_soc(db)
    logger.info(f"SOC check: {soc_summary.exact_match} exact, {soc_summary.mismatch} mismatch, {soc_summary.soc_missing} missing")

    cn_summary, unbooked = await _check_cover_notes(db)
    logger.info(f"Cover note check: {cn_summary.matched} matched, {cn_summary.unbooked} unbooked")

    dup_summary, duplicates = await _check_duplicates(db)
    logger.info(f"Duplicate check: {dup_summary.unique_refs} unique, {dup_summary.duplicate_refs} duplicate refs")

    return ReconciliationResult(
        soc_summary=soc_summary,
        soc_mismatches=soc_mismatches,
        cover_note_summary=cn_summary,
        unbooked_cover_notes=unbooked,
        duplicate_summary=dup_summary,
        duplicate_groups=duplicates,
    )
