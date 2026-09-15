from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_contracts: int
    total_claims: int
    total_premium_krw: float
    total_claims_krw: float
    open_claims: int
    closed_claims: int
    unique_reinsuers: int
    unique_cedants: int


class ChartDataPoint(BaseModel):
    label: str
    value: float


class MonthlyComparison(BaseModel):
    label: str  # "Jan", "Feb", etc.
    current: float
    previous: float


class DashboardCharts(BaseModel):
    premium_by_month: list[MonthlyComparison]
    claims_by_line: list[ChartDataPoint]
    premium_by_reinsurer: list[ChartDataPoint]
    claims_by_status: list[ChartDataPoint]


class AttentionKPI(BaseModel):
    stuck_cases: int
    unpaid_notifications: int
    pending_match: int
    new_today: int


class FunnelStage(BaseModel):
    key: str
    label: str
    count: int


class FunnelPipeline(BaseModel):
    kind: str  # "claim" | "contract"
    stages: list[FunnelStage]


class ReinsurerHotspot(BaseModel):
    reinsurer: str
    unpaid_count: int
    unpaid_amount_krw: float


class AttentionRow(BaseModel):
    kind: str  # "claim" | "contract" | "claim_draft" | "contract_draft"
    case_id: int
    ref: str
    counterparty: str  # cedant or reinsurer
    stage: str
    days: int
    severity: str  # "critical" | "warning" | "info"
    amount_krw: float
    currency: str
    assignee: str | None
    updated_at: str


class DashboardAttention(BaseModel):
    kpi: AttentionKPI
    funnels: list[FunnelPipeline]
    hotspots: list[ReinsurerHotspot]
    queue: list[AttentionRow]
