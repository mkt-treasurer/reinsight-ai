const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface DashboardSummary {
  total_contracts: number;
  total_claims: number;
  total_premium_krw: number;
  total_claims_krw: number;
  open_claims: number;
  closed_claims: number;
  unique_reinsuers: number;
  unique_cedants: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface MonthlyComparison {
  label: string;
  current: number;
  previous: number;
}

export interface DashboardCharts {
  premium_by_month: MonthlyComparison[];
  claims_by_line: ChartDataPoint[];
  premium_by_reinsurer: ChartDataPoint[];
  claims_by_status: ChartDataPoint[];
}

export interface AttentionKPI {
  stuck_cases: number;
  unpaid_notifications: number;
  pending_match: number;
  new_today: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export interface FunnelPipeline {
  kind: "claim" | "contract";
  stages: FunnelStage[];
}

export interface ReinsurerHotspot {
  reinsurer: string;
  unpaid_count: number;
  unpaid_amount_krw: number;
}

export interface AttentionRow {
  kind: "claim" | "contract" | "claim_draft" | "contract_draft";
  case_id: number;
  ref: string;
  counterparty: string;
  stage: string;
  days: number;
  severity: "critical" | "warning" | "info";
  amount_krw: number;
  currency: string;
  assignee: string | null;
  updated_at: string;
}

export interface DashboardAttention {
  kpi: AttentionKPI;
  funnels: FunnelPipeline[];
  hotspots: ReinsurerHotspot[];
  queue: AttentionRow[];
}

export interface Contract {
  id: number;
  year: number | null;
  cont_month: string | null;
  cover_note_no: string | null;
  assured: string | null;
  line: string | null;
  reinsurer: string | null;
  currency: string | null;
  ri_prem: number | null;
  net_ri_prem: number | null;
  cedant: string | null;
  rec_date: string | null;
  paid_date: string | null;
}

export interface Claim {
  id: number;
  booking_month: string | null;
  account_name: string | null;
  line: string | null;
  reinsurer: string | null;
  currency: string | null;
  total_amount: number | null;
  krw_amount: number | null;
  soc_amount: number | null;
  cedant: string | null;
  status: string | null;
  ref_no: string | null;
  account_mgr: string | null;
  dol: string | null;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface SocMismatch {
  claim_id: number;
  account_name: string | null;
  reinsurer: string | null;
  ref_no: string | null;
  krw_amount: number | null;
  soc_amount: number | null;
  difference: number | null;
}

export interface SocSummary {
  total: number;
  exact_match: number;
  mismatch: number;
  soc_missing: number;
  mismatch_total_diff: number;
}

export interface UnbookedCoverNote {
  cover_note_id: number;
  cover_note_number: string | null;
  assured: string | null;
  line: string | null;
  issuing_date: string | null;
}

export interface CoverNoteSummary {
  total_cover_notes: number;
  matched: number;
  unbooked: number;
}

export interface DuplicateGroup {
  ref_no: string;
  count: number;
  claims: Record<string, unknown>[];
}

export interface DuplicateSummary {
  total_refs: number;
  unique_refs: number;
  duplicate_refs: number;
  heavy_duplicates: number;
}

export interface ReconciliationResult {
  soc_summary: SocSummary;
  soc_mismatches: SocMismatch[];
  cover_note_summary: CoverNoteSummary;
  unbooked_cover_notes: UnbookedCoverNote[];
  duplicate_summary: DuplicateSummary;
  duplicate_groups: DuplicateGroup[];
}

export interface ChatResponse {
  answer: string;
  sql_query: string | null;
  data: Record<string, unknown>[] | null;
}
