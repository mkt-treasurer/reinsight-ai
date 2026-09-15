from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, distinct, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contract import Contract
from app.models.claim import Claim
from app.models.claim_workflow import ClaimCase, ClaimDraft
from app.models.contract_workflow import ContractCase, ContractDraft
from app.schemas.dashboard import (
    DashboardSummary,
    DashboardCharts,
    ChartDataPoint,
    MonthlyComparison,
    DashboardAttention,
    AttentionKPI,
    FunnelPipeline,
    FunnelStage,
    ReinsurerHotspot,
    AttentionRow,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


CLAIM_STAGES = [
    ("intake", "Intake"),
    ("analyzed", "Analyzed"),
    ("draft_ready", "Draft"),
    ("review", "Review"),
    ("sent", "Sent"),
    ("awaiting_payment", "Awaiting $"),
    ("completed", "Completed"),
]
CONTRACT_STAGES = [
    ("intake", "Intake"),
    ("analyzed", "Analyzed"),
    ("draft_ready", "Draft"),
    ("sent", "Sent"),
    ("payment_received", "Received"),
    ("completed", "Completed"),
]
TERMINAL = {"completed", "deleted"}

# Approximate FX for display bucketing only (not for accounting)
FX_TO_KRW = {"KRW": 1.0, "USD": 1400.0, "EUR": 1500.0, "JPY": 9.3, "GBP": 1750.0}
STUCK_DAYS = 3
WARN_DAYS = 7
CRIT_DAYS = 14
NOTIF_OVERDUE = 14


def _to_krw(amount: float | None, currency: str | None) -> float:
    if not amount:
        return 0.0
    return float(amount) * FX_TO_KRW.get((currency or "KRW").upper(), 1.0)


def _severity(days: int) -> str:
    if days >= CRIT_DAYS:
        return "critical"
    if days >= WARN_DAYS:
        return "warning"
    return "info"


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_contracts = (await db.execute(select(func.count(Contract.id)))).scalar() or 0
    total_claims = (await db.execute(select(func.count(Claim.id)))).scalar() or 0
    total_premium = (await db.execute(select(func.coalesce(func.sum(Contract.ri_prem), 0)))).scalar()
    total_claims_krw = (await db.execute(select(func.coalesce(func.sum(Claim.krw_amount), 0)))).scalar()
    open_claims = (await db.execute(select(func.count(Claim.id)).where(Claim.status == "Open"))).scalar() or 0
    closed_claims = (await db.execute(select(func.count(Claim.id)).where(Claim.status == "Closed"))).scalar() or 0
    unique_reinsurers = (await db.execute(select(func.count(distinct(Contract.reinsurer))))).scalar() or 0
    unique_cedants = (await db.execute(select(func.count(distinct(Contract.cedant))))).scalar() or 0

    return DashboardSummary(
        total_contracts=total_contracts,
        total_claims=total_claims,
        total_premium_krw=float(total_premium),
        total_claims_krw=float(total_claims_krw),
        open_claims=open_claims,
        closed_claims=closed_claims,
        unique_reinsuers=unique_reinsurers,
        unique_cedants=unique_cedants,
    )


@router.get("/charts", response_model=DashboardCharts)
async def get_charts(db: AsyncSession = Depends(get_db)):
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    month_map = {
        "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
        "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
    }

    all_monthly = (await db.execute(text("""
        SELECT year, cont_month, SUM(ri_prem) as total
        FROM contracts
        WHERE cont_month IS NOT NULL AND year IS NOT NULL AND year >= 2024
        GROUP BY year, cont_month
    """))).all()

    monthly_lookup: dict[tuple[int, int], float] = {}
    for r in all_monthly:
        mn = month_map.get(r[1])
        if mn:
            monthly_lookup[(int(r[0]), mn)] = float(r[2] or 0)

    current_year = 2026
    previous_year = 2025
    prem_by_month = [
        MonthlyComparison(
            label=month_names[m - 1],
            current=monthly_lookup.get((current_year, m), 0),
            previous=monthly_lookup.get((previous_year, m), 0),
        )
        for m in range(1, 13)
    ]

    claims_by_line = (await db.execute(
        select(Claim.line, func.sum(Claim.krw_amount))
        .where(Claim.line.isnot(None))
        .group_by(Claim.line)
        .order_by(func.sum(Claim.krw_amount).desc())
        .limit(10)
    )).all()

    prem_by_reinsurer = (await db.execute(
        select(Contract.reinsurer, func.sum(Contract.ri_prem))
        .where(Contract.reinsurer.isnot(None))
        .group_by(Contract.reinsurer)
        .order_by(func.sum(Contract.ri_prem).desc())
        .limit(10)
    )).all()

    claims_by_status = (await db.execute(
        select(Claim.status, func.count(Claim.id))
        .where(Claim.status.isnot(None))
        .group_by(Claim.status)
    )).all()

    return DashboardCharts(
        premium_by_month=prem_by_month,
        claims_by_line=[ChartDataPoint(label=r[0] or "Unknown", value=float(r[1] or 0)) for r in claims_by_line],
        premium_by_reinsurer=[ChartDataPoint(label=r[0] or "Unknown", value=float(r[1] or 0)) for r in prem_by_reinsurer],
        claims_by_status=[ChartDataPoint(label=r[0] or "Unknown", value=float(r[1] or 0)) for r in claims_by_status],
    )


@router.get("/attention", response_model=DashboardAttention)
async def get_attention(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    stuck_cutoff = now - timedelta(days=STUCK_DAYS)
    notif_cutoff = now - timedelta(days=NOTIF_OVERDUE)
    today_start = datetime.combine(now.date(), datetime.min.time())

    # Funnels
    claim_counts_rows = (await db.execute(
        select(ClaimCase.status, func.count(ClaimCase.id))
        .where(ClaimCase.is_deleted.is_(False))
        .group_by(ClaimCase.status)
    )).all()
    claim_counts = {r[0]: int(r[1]) for r in claim_counts_rows}
    contract_counts_rows = (await db.execute(
        select(ContractCase.status, func.count(ContractCase.id))
        .where(ContractCase.is_deleted.is_(False))
        .group_by(ContractCase.status)
    )).all()
    contract_counts = {r[0]: int(r[1]) for r in contract_counts_rows}

    funnels = [
        FunnelPipeline(
            kind="claim",
            stages=[FunnelStage(key=k, label=l, count=claim_counts.get(k, 0)) for k, l in CLAIM_STAGES],
        ),
        FunnelPipeline(
            kind="contract",
            stages=[FunnelStage(key=k, label=l, count=contract_counts.get(k, 0)) for k, l in CONTRACT_STAGES],
        ),
    ]

    # Stuck claim cases
    stuck_claims = (await db.execute(
        select(ClaimCase)
        .where(and_(
            ClaimCase.is_deleted.is_(False),
            ClaimCase.status.notin_(list(TERMINAL)),
            ClaimCase.updated_at < stuck_cutoff,
        ))
        .order_by(ClaimCase.updated_at.asc())
        .limit(100)
    )).scalars().all()

    stuck_contracts = (await db.execute(
        select(ContractCase)
        .where(and_(
            ContractCase.is_deleted.is_(False),
            ContractCase.status.notin_(list(TERMINAL)),
            ContractCase.updated_at < stuck_cutoff,
        ))
        .order_by(ContractCase.updated_at.asc())
        .limit(100)
    )).scalars().all()

    # Overdue notifications (drafts sent but unpaid)
    overdue_claim_drafts = (await db.execute(
        select(ClaimDraft)
        .where(and_(
            ClaimDraft.sent_at.isnot(None),
            ClaimDraft.paid_at.is_(None),
            ClaimDraft.sent_at < notif_cutoff,
        ))
        .order_by(ClaimDraft.sent_at.asc())
        .limit(100)
    )).scalars().all()

    overdue_contract_drafts = (await db.execute(
        select(ContractDraft)
        .where(and_(
            ContractDraft.sent_at.isnot(None),
            ContractDraft.paid_at.is_(None),
            ContractDraft.sent_at < notif_cutoff,
        ))
        .order_by(ContractDraft.sent_at.asc())
        .limit(100)
    )).scalars().all()

    # KPI
    pending_match = (await db.execute(
        select(func.count(ClaimCase.id))
        .where(and_(
            ClaimCase.is_deleted.is_(False),
            ClaimCase.status == "intake",
            ClaimCase.matched_policy_id.is_(None),
        ))
    )).scalar() or 0
    pending_match += (await db.execute(
        select(func.count(ContractCase.id))
        .where(and_(
            ContractCase.is_deleted.is_(False),
            ContractCase.status == "intake",
            ContractCase.matched_policy_id.is_(None),
        ))
    )).scalar() or 0

    new_today = (await db.execute(
        select(func.count(ClaimCase.id)).where(ClaimCase.created_at >= today_start)
    )).scalar() or 0
    new_today += (await db.execute(
        select(func.count(ContractCase.id)).where(ContractCase.created_at >= today_start)
    )).scalar() or 0

    kpi = AttentionKPI(
        stuck_cases=len(stuck_claims) + len(stuck_contracts),
        unpaid_notifications=len(overdue_claim_drafts) + len(overdue_contract_drafts),
        pending_match=int(pending_match),
        new_today=int(new_today),
    )

    # Hotspots: group overdue drafts by reinsurer, sum amounts
    hot: dict[str, dict] = {}
    for d in overdue_claim_drafts:
        key = d.reinsurer or "Unknown"
        h = hot.setdefault(key, {"count": 0, "amount": 0.0})
        h["count"] += 1
        h["amount"] += _to_krw(float(d.amount) if d.amount else 0, d.currency)
    for d in overdue_contract_drafts:
        key = d.reinsurer or "Unknown"
        h = hot.setdefault(key, {"count": 0, "amount": 0.0})
        h["count"] += 1
        h["amount"] += _to_krw(float(d.ri_premium) if d.ri_premium else 0, None)
    hotspots = [
        ReinsurerHotspot(reinsurer=r, unpaid_count=v["count"], unpaid_amount_krw=v["amount"])
        for r, v in sorted(hot.items(), key=lambda x: -x[1]["amount"])[:5]
    ]

    # Queue — unified
    queue: list[AttentionRow] = []
    sev_rank = {"critical": 0, "warning": 1, "info": 2}

    for c in stuck_claims:
        days = (now - c.updated_at).days if c.updated_at else 0
        queue.append(AttentionRow(
            kind="claim",
            case_id=c.id,
            ref=c.ref_no or f"CL-{c.id}",
            counterparty=c.cedant or "—",
            stage=c.status,
            days=days,
            severity=_severity(days),
            amount_krw=_to_krw(float(c.total_amount) if c.total_amount else 0, c.currency),
            currency=c.currency or "KRW",
            assignee=c.assigned_to,
            updated_at=c.updated_at.isoformat() if c.updated_at else "",
        ))
    for c in stuck_contracts:
        days = (now - c.updated_at).days if c.updated_at else 0
        queue.append(AttentionRow(
            kind="contract",
            case_id=c.id,
            ref=c.cover_note_no or f"CT-{c.id}",
            counterparty=c.cedant or "—",
            stage=c.status,
            days=days,
            severity=_severity(days),
            amount_krw=_to_krw(float(c.gross_premium) if c.gross_premium else 0, c.currency),
            currency=c.currency or "KRW",
            assignee=None,
            updated_at=c.updated_at.isoformat() if c.updated_at else "",
        ))
    for d in overdue_claim_drafts:
        days = (now - d.sent_at).days if d.sent_at else 0
        queue.append(AttentionRow(
            kind="claim_draft",
            case_id=d.case_id,
            ref=f"CL-{d.case_id}",
            counterparty=d.reinsurer or "—",
            stage="awaiting_payment",
            days=days,
            severity=_severity(days),
            amount_krw=_to_krw(float(d.amount) if d.amount else 0, d.currency),
            currency=d.currency or "KRW",
            assignee=None,
            updated_at=d.sent_at.isoformat() if d.sent_at else "",
        ))
    for d in overdue_contract_drafts:
        days = (now - d.sent_at).days if d.sent_at else 0
        queue.append(AttentionRow(
            kind="contract_draft",
            case_id=d.case_id,
            ref=f"CT-{d.case_id}",
            counterparty=d.reinsurer or "—",
            stage="awaiting_payment",
            days=days,
            severity=_severity(days),
            amount_krw=_to_krw(float(d.ri_premium) if d.ri_premium else 0, None),
            currency="KRW",
            assignee=None,
            updated_at=d.sent_at.isoformat() if d.sent_at else "",
        ))

    queue.sort(key=lambda r: (sev_rank[r.severity], -r.days))
    queue = queue[:50]

    result = DashboardAttention(kpi=kpi, funnels=funnels, hotspots=hotspots, queue=queue)

    # Demo fallback: if the database is empty, return a representative payload so
    # the operations desk doesn't render a wall of zeros. This is auto-disabled
    # as soon as any real workflow data exists.
    if _is_empty(result):
        return _demo_attention(now)

    return result


def _is_empty(d: DashboardAttention) -> bool:
    k = d.kpi
    return (
        k.stuck_cases == 0
        and k.unpaid_notifications == 0
        and k.pending_match == 0
        and k.new_today == 0
        and not d.queue
        and not d.hotspots
        and all(s.count == 0 for f in d.funnels for s in f.stages)
    )


def _demo_attention(now: datetime) -> DashboardAttention:
    kpi = AttentionKPI(
        stuck_cases=9,
        unpaid_notifications=5,
        pending_match=12,
        new_today=4,
    )

    funnels = [
        FunnelPipeline(
            kind="claim",
            stages=[
                FunnelStage(key="intake", label="Intake", count=6),
                FunnelStage(key="analyzed", label="Analyzed", count=4),
                FunnelStage(key="draft_ready", label="Draft", count=3),
                FunnelStage(key="review", label="Review", count=2),
                FunnelStage(key="sent", label="Sent", count=5),
                FunnelStage(key="awaiting_payment", label="Awaiting $", count=3),
                FunnelStage(key="completed", label="Completed", count=11),
            ],
        ),
        FunnelPipeline(
            kind="contract",
            stages=[
                FunnelStage(key="intake", label="Intake", count=7),
                FunnelStage(key="analyzed", label="Analyzed", count=5),
                FunnelStage(key="draft_ready", label="Draft", count=4),
                FunnelStage(key="sent", label="Sent", count=6),
                FunnelStage(key="payment_received", label="Received", count=4),
                FunnelStage(key="completed", label="Completed", count=14),
            ],
        ),
    ]

    hotspots = [
        ReinsurerHotspot(reinsurer="Munich Re", unpaid_count=3, unpaid_amount_krw=4.2e9),
        ReinsurerHotspot(reinsurer="Swiss Re", unpaid_count=2, unpaid_amount_krw=2.9e9),
        ReinsurerHotspot(reinsurer="Hannover Re", unpaid_count=2, unpaid_amount_krw=1.6e9),
        ReinsurerHotspot(reinsurer="SCOR", unpaid_count=1, unpaid_amount_krw=820_000_000),
        ReinsurerHotspot(reinsurer="Lloyd's Syndicate 33", unpaid_count=1, unpaid_amount_krw=540_000_000),
    ]

    demo_rows = [
        # (kind, case_id, ref, counterparty, stage, days, amount_krw, assignee)
        ("claim", 1001, "CL-2026-0142", "Samsung Fire & Marine", "review", 21, 3_400_000_000, "J. Park"),
        ("claim_draft", 1002, "CL-2026-0138", "Munich Re", "awaiting_payment", 28, 2_800_000_000, None),
        ("contract", 2003, "CT-2026-0091", "Hyundai Marine", "analyzed", 17, 1_950_000_000, "S. Kim"),
        ("claim", 1004, "CL-2026-0151", "DB Insurance", "draft_ready", 15, 1_650_000_000, "H. Lee"),
        ("contract_draft", 2005, "CT-2026-0084", "Swiss Re", "awaiting_payment", 22, 1_420_000_000, None),
        ("claim", 1006, "CL-2026-0149", "KB Insurance", "sent", 11, 1_180_000_000, "J. Park"),
        ("contract", 2007, "CT-2026-0096", "Hannover Re", "draft_ready", 9, 980_000_000, "M. Choi"),
        ("claim_draft", 1008, "CL-2026-0133", "Hannover Re", "awaiting_payment", 19, 920_000_000, None),
        ("contract", 2009, "CT-2026-0102", "Korean Re", "intake", 6, 760_000_000, None),
        ("claim", 1010, "CL-2026-0156", "Meritz F&M", "analyzed", 8, 640_000_000, "S. Kim"),
        ("contract_draft", 2011, "CT-2026-0079", "SCOR", "awaiting_payment", 17, 540_000_000, None),
        ("claim", 1012, "CL-2026-0160", "Heungkuk F&M", "intake", 5, 420_000_000, None),
        ("contract", 2013, "CT-2026-0105", "Lloyd's Syndicate 33", "review", 7, 380_000_000, "H. Lee"),
        ("claim", 1014, "CL-2026-0162", "NH Property", "intake", 4, 280_000_000, None),
        ("contract", 2015, "CT-2026-0108", "MS&AD", "sent", 3, 210_000_000, "M. Choi"),
    ]

    queue: list[AttentionRow] = []
    for kind, case_id, ref, cp, stage, days, amount, assignee in demo_rows:
        queue.append(AttentionRow(
            kind=kind,
            case_id=case_id,
            ref=ref,
            counterparty=cp,
            stage=stage,
            days=days,
            severity=_severity(days),
            amount_krw=float(amount),
            currency="KRW",
            assignee=assignee,
            updated_at=(now - timedelta(days=days)).isoformat(),
        ))

    sev_rank = {"critical": 0, "warning": 1, "info": 2}
    queue.sort(key=lambda r: (sev_rank[r.severity], -r.days))

    return DashboardAttention(kpi=kpi, funnels=funnels, hotspots=hotspots, queue=queue)
