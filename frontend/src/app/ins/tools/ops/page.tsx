"use client";

// Operations dashboard — reads the firm's master contract-management ledger
// (AI계약관리.xlsx) and renders the weekly operation worklists plus a portfolio
// roll-up. Self-contained / experimental: talks only to the isolated
// /api/tools/ops backend (no DB), mirroring rq-slip and weekly-dashboard.
//
// Upload the master workbook → each upload is stored as a dated snapshot, so
// the per-manager view shows week-over-week movement. Four worklists:
// PPW collection, AR/AP settlement, renewal pipeline, and per-manager progress.
//
// Styling follows DESIGN.md: slate palette + single red accent, sharp corners,
// no colored card fills, no emoji.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";
const BASE = `${API_URL}/api/tools/ops`;

const DUE_SOON_DAYS = 30; // PPW window flagged "due soon"
const RENEW_WINDOW_DAYS = 90; // expiry window for the renewal pipeline

// Overdue-age buckets for AR/AP aging. `max` is inclusive; the last bucket is open-ended.
const AGING_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "0–30일", min: 0, max: 30 },
  { label: "31–60일", min: 31, max: 60 },
  { label: "61–90일", min: 61, max: 90 },
  { label: "90일+", min: 91, max: Infinity },
];

// ─── types ──────────────────────────────────────────────────────────────
interface Row {
  book_year: number | null;
  cont_month: string | null;
  cover_note: string | null;
  assured: string | null;
  line: string | null;
  new_renew: string | null;
  cedant: string | null;
  date_from: string | null;
  date_to: string | null;
  ppw: string | null;
  currency: string | null;
  gross_prem_100: number | null;
  reinsurer: string | null;
  share: number | null;
  ri_prem: number | null;
  net_to_uwr: number | null;
  brokerage: number | null;
  rec_date: string | null;
  paid_date: string | null;
  account_mgr: string | null;
  producer: string | null;
}
// One cash movement from the 선수금 (advance-payment) settlement ledger. The
// backend ships only the OPEN rows (received-not-remitted or non-zero balance),
// projected to just these display columns (SETTLE_SHIP_FIELDS); the full ledger
// is rolled up into SettleSummary instead. FX markers / 수수료 / ROE etc. live
// only in the summary, never per shipped row.
interface SettleRow {
  recv_date: string | null;
  recv_krw: number | null;
  recv_usd: number | null;
  reinsurer: string | null;
  remit_date: string | null;
  balance: number | null;
  assured: string | null;
  account_mgr: string | null;
}
interface SettleSummary {
  recv_krw: number;
  recv_usd: number;
  remit_krw: number;
  remit_usd: number;
  balance_krw: number;
  fx_gain: number;
  fx_loss: number;
  open_count: number;
  row_count: number;
  by_year: Record<string, { recv_krw: number; balance_krw: number; open_count: number }>;
}
interface SnapMeta {
  snapshot_id: string;
  uploaded_at: string | null;
  filename: string | null;
  sheets: Record<string, number>;
  settlement_sheets?: Record<string, number>;
  row_count: number;
  settlement_count?: number;
}
interface OpsData {
  snapshots: SnapMeta[];
  latest: SnapMeta | null;
  years: number[];
  year: number | null;
  rows: Row[];
  prev_rows: Row[];
  prev_snapshot_id: string | null;
  settlement: SettleRow[];
  settlement_summary: SettleSummary | null;
}

// ─── date / number helpers ────────────────────────────────────────────────
const todayIso = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const TODAY = todayIso();

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}
function addDays(iso: string, n: number): string {
  const d = new Date(Date.parse(iso) + n * 86_400_000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function fmtAmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
function fmtMoney(n: number, ccy: string): string {
  if (Math.abs(n) >= 1e8) return `${ccy} ${(n / 1e8).toFixed(2)}억`;
  if (Math.abs(n) >= 1e4) return `${ccy} ${(n / 1e4).toFixed(0)}만`;
  return `${ccy} ${fmtAmt(n)}`;
}

const contractKey = (r: Row): string =>
  r.cover_note || `${r.assured ?? "?"}|${r.date_from ?? ""}|${r.line ?? ""}`;

// ─── view ────────────────────────────────────────────────────────────────
type Tab = "ppw" | "settle" | "renewal" | "manager";

export default function OpsDashboardPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ppw");
  const fileRef = useRef<HTMLInputElement>(null);

  // The backend filters contract rows to one booking year (default: latest) so
  // we never download the full ~21k-row / 15 MB ledger; switching year refetches.
  const load = useCallback(async (yr?: number | null) => {
    setLoading(true);
    try {
      const qs = yr != null ? `?year=${yr}` : "";
      const res = await fetch(`${BASE}/data${qs}`);
      if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
      const json = (await res.json()) as OpsData;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `업로드 실패 (${res.status})`);
      }
      await load(data?.year ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteSnapshot = async (id: string) => {
    if (!confirm(`스냅샷 ${id} 을(를) 삭제할까요?`)) return;
    await fetch(`${BASE}/snapshots/${id}`, { method: "DELETE" });
    await load(data?.year ?? null);
  };

  // Year list + the active year both come from the server; the selector
  // refetches instead of filtering a fully-downloaded dataset client-side.
  const years = data?.years ?? [];
  const year = data?.year ?? null;
  const rows = data?.rows ?? [];
  const prevRows = data?.prev_rows ?? [];

  if (loading) return <Shell><p className="text-[12px] text-slate-500">불러오는 중…</p></Shell>;

  const hasData = !!data?.latest;

  return (
    <Shell>
      <Header
        snapshots={data?.snapshots ?? []}
        latest={data?.latest ?? null}
        years={years}
        year={year}
        setYear={(y) => load(y)}
        uploading={uploading}
        fileRef={fileRef}
        onUpload={upload}
        onDelete={deleteSnapshot}
      />

      {error && (
        <p className="text-[11px] text-red-700 border border-red-200 bg-red-50 px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {year !== null && year === years[0] && (
            <p className="text-[11px] text-amber-800 border border-amber-200 bg-amber-50 px-3 py-2 mb-3">
              {year}년은 <b>진행 중인 연도</b>입니다 — 조약 갱신(Q1) 등 시즌 편중으로 담당자·보종 분포가
              한쪽으로 보일 수 있습니다. 완결 연도({years[1] ?? "직전 연도"})와 비교해 해석하세요.
            </p>
          )}
          <Kpis rows={rows} />
          <nav className="flex gap-1 border-b border-slate-200 mb-4 mt-6">
            {([
              ["ppw", "PPW 수금/연체"],
              ["settle", "정산 미완 (AR/AP)"],
              ["renewal", "갱신 파이프라인"],
              ["manager", "담당자별 + WoW"],
            ] as [Tab, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] border-b-2 -mb-px transition-colors ${
                  tab === id
                    ? "border-red-700 text-slate-900"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "ppw" && <PpwView rows={rows} />}
          {tab === "settle" && (
            <SettleView
              rows={rows}
              settlement={data?.settlement ?? []}
              summary={data?.settlement_summary ?? null}
            />
          )}
          {tab === "renewal" && <RenewalView rows={rows} />}
          {tab === "manager" && (
            <ManagerView rows={rows} prevRows={prevRows} prevId={data?.prev_snapshot_id ?? null} />
          )}
        </>
      )}
    </Shell>
  );
}

// ─── layout ────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      <div className="border-b border-slate-900 px-6 py-4 flex items-center gap-6 bg-slate-900 text-white">
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase">
          Operations · 계약관리
        </span>
        <span className="text-[10px] text-slate-400 tracking-wider hidden md:inline">
          AI계약관리 원장 → 주간 운영 워크리스트 + 포트폴리오
        </span>
        <span className="flex-1" />
        <span className="text-[10px] font-mono text-slate-300">TOOL · ops/v0 · experimental</span>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Header({
  snapshots, latest, years, year, setYear, uploading, fileRef, onUpload, onDelete,
}: {
  snapshots: SnapMeta[];
  latest: SnapMeta | null;
  years: number[];
  year: number | null;
  setYear: (y: number) => void;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (f: File) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div className="flex items-end gap-4">
        {years.length > 0 && (
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
              Booking Year
            </span>
            <select
              value={year ?? ""}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:border-slate-900"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </label>
        )}
        {latest && (
          <div className="text-[10px] text-slate-500 leading-relaxed">
            <div>최신 스냅샷: <span className="font-mono text-slate-700">{latest.snapshot_id}</span></div>
            <div className="text-slate-400">{latest.filename} · {latest.row_count.toLocaleString()} shares</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {snapshots.length > 0 && (
          <select
            onChange={(e) => e.target.value && onDelete(e.target.value)}
            value=""
            className="border border-slate-300 px-2 py-1.5 text-[10px] text-slate-500 focus:outline-none"
            title="스냅샷 삭제"
          >
            <option value="">스냅샷 {snapshots.length}개 ▾</option>
            {snapshots.map((s) => (
              <option key={s.snapshot_id} value={s.snapshot_id}>삭제: {s.snapshot_id}</option>
            ))}
          </select>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-700 disabled:opacity-40"
        >
          {uploading ? "업로드 중…" : "원장 업로드"}
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-slate-300 px-6 py-16 text-center">
      <p className="text-[13px] text-slate-700 font-bold mb-1">아직 업로드된 원장이 없습니다</p>
      <p className="text-[11px] text-slate-500">
        우측 상단 “원장 업로드”로 AI계약관리.xlsx 를 올리면 주간 운영 워크리스트가 생성됩니다.
      </p>
    </div>
  );
}

// ─── KPIs ────────────────────────────────────────────────────────────────
function Kpis({ rows }: { rows: Row[] }) {
  const stats = useMemo(() => {
    const contracts = new Set(rows.map(contractKey));
    const byCcy: Record<string, number> = {};
    let brokerage = 0;
    let recv = 0;
    rows.forEach((r) => {
      if (r.gross_prem_100 && r.currency) byCcy[r.currency] = (byCcy[r.currency] ?? 0) + r.gross_prem_100;
      if (r.brokerage) brokerage += r.brokerage;
      if (r.rec_date) recv += 1;
    });
    return {
      contracts: contracts.size,
      shares: rows.length,
      byCcy,
      brokerage,
      settledPct: rows.length ? Math.round((recv / rows.length) * 100) : 0,
    };
  }, [rows]);

  const topCcy = Object.entries(stats.byCcy).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200">
      <Kpi label="계약 / Shares" value={`${stats.contracts.toLocaleString()} / ${stats.shares.toLocaleString()}`} />
      <Kpi
        label="GWP (통화별)"
        value={topCcy.length ? topCcy.map(([c, v]) => fmtMoney(v, c)).join("  ·  ") : "—"}
      />
      <Kpi label="중개수수료" value={stats.brokerage ? fmtAmt(stats.brokerage) : "—"} />
      <Kpi label="정산 완료율(수금)" value={`${stats.settledPct}%`} />
    </div>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1">{label}</div>
      <div className="text-[14px] font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

// ─── shared table chrome ────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 border-b border-slate-300 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td className={`px-3 py-1.5 text-[11px] text-slate-700 border-b border-slate-100 ${right ? "text-right tabular-nums" : ""} ${mono ? "font-mono" : ""}`}>
      {children}
    </td>
  );
}
function Count({ n, tone }: { n: number; tone?: "red" | "amber" | "slate" }) {
  const c = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  return <span className={`font-bold ${c}`}>{n.toLocaleString()}</span>;
}

// ─── PPW collection worklist (contract grain) ──────────────────────────────
interface PpwItem {
  key: string;
  cover_note: string | null;
  assured: string | null;
  cedant: string | null;
  ppw: string;
  days: number; // negative = overdue
  gross: number | null;
  currency: string | null;
  mgr: string | null;
  openShares: number;
}
function PpwView({ rows }: { rows: Row[] }) {
  const items = useMemo<PpwItem[]>(() => {
    const groups = new Map<string, Row[]>();
    rows.forEach((r) => {
      const k = contractKey(r);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
    });
    const out: PpwItem[] = [];
    groups.forEach((grp, key) => {
      const ppw = grp.find((r) => r.ppw)?.ppw;
      if (!ppw) return;
      const horizon = addDays(TODAY, DUE_SOON_DAYS);
      if (ppw > horizon) return; // not due yet
      const openShares = grp.filter((r) => !r.rec_date).length;
      if (openShares === 0) return; // fully collected
      const head = grp[0];
      out.push({
        key,
        cover_note: head.cover_note,
        assured: head.assured,
        cedant: head.cedant,
        ppw,
        days: daysBetween(TODAY, ppw),
        gross: head.gross_prem_100,
        currency: head.currency,
        mgr: head.account_mgr,
        openShares,
      });
    });
    return out.sort((a, b) => a.ppw.localeCompare(b.ppw));
  }, [rows]);

  const overdue = items.filter((i) => i.days < 0).length;
  const soon = items.length - overdue;

  return (
    <section>
      <Legend>
        납입기한(PPW) 도래·연체이면서 미수금 share가 남은 계약. <Count n={overdue} tone="red" /> 연체 ·{" "}
        <Count n={soon} tone="amber" /> 30일 내 도래.
      </Legend>
      {items.length === 0 ? (
        <Empty>수금 대기 항목이 없습니다.</Empty>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>상태</Th><Th>Cover Note</Th><Th>Assured</Th><Th>Cedant</Th>
              <Th>PPW</Th><Th right>D-day</Th><Th right>Gross(100%)</Th><Th>미수 shares</Th><Th>담당</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.key} className="hover:bg-slate-50">
                <Td>
                  <Pill tone={i.days < 0 ? "red" : "amber"}>{i.days < 0 ? "연체" : "도래"}</Pill>
                </Td>
                <Td mono>{i.cover_note ?? "—"}</Td>
                <Td>{i.assured ?? "—"}</Td>
                <Td>{i.cedant ?? "—"}</Td>
                <Td mono>{i.ppw}</Td>
                <Td right>{i.days < 0 ? `+${-i.days}d` : `D-${i.days}`}</Td>
                <Td right>{i.gross != null ? `${i.currency ?? ""} ${fmtAmt(i.gross)}` : "—"}</Td>
                <Td>{i.openShares}</Td>
                <Td>{i.mgr ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ─── settlement AR/AP ────────────────────────────────────────────────────────
// Reads from two ledgers: the contract ledger's Rec./Paid dates (premium
// collection status, share grain) and the real 선수금 cash ledger shipped by the
// backend as open rows + a roll-up summary (advance balance + FX markers).
const ROW_CAP = 300;

// Days overdue relative to a reference date (negative ⇒ not yet due ⇒ no bucket).
function overdueAge(refIso: string | null): number | null {
  if (!refIso) return null;
  const d = daysBetween(refIso, TODAY);
  return d >= 0 ? d : null;
}
function bucketize<T>(items: T[], ageOf: (t: T) => number | null): number[] {
  return AGING_BUCKETS.map(
    (b) => items.filter((it) => {
      const a = ageOf(it);
      return a !== null && a >= b.min && a <= b.max;
    }).length,
  );
}

function SettleView({
  rows, settlement, summary,
}: { rows: Row[]; settlement: SettleRow[]; summary: SettleSummary | null }) {
  const { awaitingRec, awaitingPay } = useMemo(() => ({
    awaitingRec: rows.filter((r) => !r.rec_date && (r.reinsurer || r.share != null)),
    awaitingPay: rows.filter((r) => r.rec_date && !r.paid_date),
  }), [rows]);

  // 선수금 송금 미완: received from cedant, not yet remitted to reinsurer.
  const remitPending = useMemo(
    () => settlement
      .filter((s) => s.recv_date && !s.remit_date)
      .sort((a, b) => (a.recv_date ?? "").localeCompare(b.recv_date ?? "")),
    [settlement],
  );

  const recAging = useMemo(() => bucketize(awaitingRec, (r) => overdueAge(r.ppw)), [awaitingRec]);
  const remitAging = useMemo(
    () => bucketize(remitPending, (s) => overdueAge(s.recv_date)), [remitPending]);

  return (
    <section className="space-y-8">
      {summary && <SettleSummaryStrip summary={summary} />}

      <div>
        <Legend>
          <b>수금 대기 (AR)</b> — 계약원장 Rec. Date 미입력 share. <Count n={awaitingRec.length} tone="amber" /> 건 ·
          PPW 경과 기준 연령 분석.
        </Legend>
        <AgingBar counts={recAging} />
        <ShareTable rows={awaitingRec.slice(0, ROW_CAP)} dateLabel="PPW" dateKey="ppw" />
        {awaitingRec.length > ROW_CAP && <More n={awaitingRec.length - ROW_CAP} />}
      </div>

      <div>
        <Legend>
          <b>송금 대기 (AP)</b> — 수금됐으나 Paid Date 미입력 (재보험사 송금 대기).{" "}
          <Count n={awaitingPay.length} tone="amber" /> 건.
        </Legend>
        <ShareTable rows={awaitingPay.slice(0, ROW_CAP)} dateLabel="Rec. Date" dateKey="rec_date" />
        {awaitingPay.length > ROW_CAP && <More n={awaitingPay.length - ROW_CAP} />}
      </div>

      <div>
        <Legend>
          <b>선수금 송금 미완</b> — 선수금 원장 기준: 입금됐으나 재보험사 송금 미완.{" "}
          <Count n={remitPending.length} tone="red" /> 건 · 입금일 경과 기준 연령 분석.
        </Legend>
        <AgingBar counts={remitAging} />
        {remitPending.length === 0 ? (
          <Empty>선수금 송금 미완 항목이 없습니다.</Empty>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>입금일</Th><Th right>경과</Th><Th>Reinsurer</Th><Th>Assured</Th>
                <Th right>입금 KRW</Th><Th right>입금 USD</Th><Th right>선수금잔액</Th><Th>담당</Th>
              </tr>
            </thead>
            <tbody>
              {remitPending.slice(0, ROW_CAP).map((s, i) => {
                const age = overdueAge(s.recv_date);
                return (
                  <tr key={`${s.recv_date}-${s.reinsurer}-${i}`} className="hover:bg-slate-50">
                    <Td mono>{s.recv_date ?? "—"}</Td>
                    <Td right>{age === null ? "—" : `+${age}d`}</Td>
                    <Td>{s.reinsurer ?? "—"}</Td>
                    <Td>{s.assured ?? "—"}</Td>
                    <Td right>{s.recv_krw != null ? fmtAmt(s.recv_krw) : "—"}</Td>
                    <Td right>{s.recv_usd != null ? s.recv_usd.toLocaleString() : "—"}</Td>
                    <Td right>{s.balance != null && s.balance !== 0 ? fmtAmt(s.balance) : "—"}</Td>
                    <Td>{s.account_mgr ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {remitPending.length > ROW_CAP && <More n={remitPending.length - ROW_CAP} />}
      </div>
    </section>
  );
}

// Currency-split summary — KRW and USD are never blindly added together.
function SettleSummaryStrip({ summary }: { summary: SettleSummary }) {
  const years = Object.entries(summary.by_year).slice(0, 6);
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 mb-3">
        <Kpi label="선수금 입금 (KRW)" value={fmtMoney(summary.recv_krw, "₩")} />
        <Kpi label="선수금 입금 (USD)" value={`$ ${fmtAmt(summary.recv_usd)}`} />
        <Kpi label="선수금 잔액 (KRW)" value={fmtMoney(summary.balance_krw, "₩")} />
        <Kpi
          label="미정산 / 환차익·손"
          value={`${summary.open_count.toLocaleString()}건 · 익${summary.fx_gain}/손${summary.fx_loss}`}
        />
      </div>
      {years.length > 0 && (
        <p className="text-[10px] text-slate-500 leading-relaxed">
          연도별 잔액:{" "}
          {years.map(([y, v], idx) => (
            <span key={y}>
              {idx > 0 && " · "}
              <span className="font-mono text-slate-700">{y}</span>{" "}
              {fmtMoney(v.balance_krw, "₩")} ({v.open_count}건)
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// Horizontal aging breakdown across AGING_BUCKETS; the 90일+ bucket inks red.
function AgingBar({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div className="flex border border-slate-200 mb-3 text-[10px]">
      {AGING_BUCKETS.map((b, i) => {
        const n = counts[i] ?? 0;
        const isTail = i === AGING_BUCKETS.length - 1;
        return (
          <div
            key={b.label}
            className={`flex-1 px-3 py-2 ${i > 0 ? "border-l border-slate-200" : ""} ${
              isTail && n > 0 ? "bg-red-50" : "bg-white"
            }`}
          >
            <div className="font-bold uppercase tracking-[0.1em] text-slate-400">{b.label}</div>
            <div className={`text-[14px] font-bold tabular-nums ${isTail && n > 0 ? "text-red-700" : "text-slate-900"}`}>
              {n.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function ShareTable({ rows, dateLabel, dateKey }: { rows: Row[]; dateLabel: string; dateKey: keyof Row }) {
  if (rows.length === 0) return <Empty>해당 항목이 없습니다.</Empty>;
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <Th>Cover Note</Th><Th>Assured</Th><Th>Reinsurer</Th><Th right>Share</Th>
          <Th right>R/I Prem</Th><Th>{dateLabel}</Th><Th>담당</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${contractKey(r)}-${r.reinsurer}-${i}`} className="hover:bg-slate-50">
            <Td mono>{r.cover_note ?? "—"}</Td>
            <Td>{r.assured ?? "—"}</Td>
            <Td>{r.reinsurer ?? "—"}</Td>
            <Td right>{r.share != null ? `${(r.share * 100).toFixed(1)}%` : "—"}</Td>
            <Td right>{r.ri_prem != null ? `${r.currency ?? ""} ${fmtAmt(r.ri_prem)}` : "—"}</Td>
            <Td mono>{(r[dateKey] as string | null) ?? "—"}</Td>
            <Td>{r.account_mgr ?? "—"}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── renewal pipeline (contract grain) ─────────────────────────────────────
function RenewalView({ rows }: { rows: Row[] }) {
  const items = useMemo(() => {
    const groups = new Map<string, Row>();
    rows.forEach((r) => {
      const k = contractKey(r);
      if (!groups.has(k)) groups.set(k, r);
    });
    const horizon = addDays(TODAY, RENEW_WINDOW_DAYS);
    return [...groups.values()]
      .filter((r) => r.date_to && r.date_to >= TODAY && r.date_to <= horizon)
      .sort((a, b) => (a.date_to ?? "").localeCompare(b.date_to ?? ""));
  }, [rows]);

  return (
    <section>
      <Legend>
        향후 {RENEW_WINDOW_DAYS}일 내 만기(To) 도래 계약 — 갱신 준비 대상. <Count n={items.length} /> 건.
        RQ 슬립 초안을 바로 생성할 수 있습니다.
      </Legend>
      {items.length === 0 ? (
        <Empty>90일 내 만기 계약이 없습니다.</Empty>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>만기(To)</Th><Th right>D-day</Th><Th>Assured</Th><Th>Line</Th>
              <Th>Cedant</Th><Th right>Gross(100%)</Th><Th>담당</Th><Th>액션</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={contractKey(r)} className="hover:bg-slate-50">
                <Td mono>{r.date_to}</Td>
                <Td right>D-{daysBetween(TODAY, r.date_to!)}</Td>
                <Td>{r.assured ?? "—"}</Td>
                <Td>{r.line ?? "—"}</Td>
                <Td>{r.cedant ?? "—"}</Td>
                <Td right>{r.gross_prem_100 != null ? `${r.currency ?? ""} ${fmtAmt(r.gross_prem_100)}` : "—"}</Td>
                <Td>{r.account_mgr ?? "—"}</Td>
                <Td>
                  <Link
                    href="/ins/tools/rq-slip"
                    className="text-[10px] font-bold uppercase tracking-wider text-red-700 hover:underline"
                  >
                    RQ 생성 →
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ─── per-manager + WoW ──────────────────────────────────────────────────────
interface MgrAgg {
  mgr: string;
  contracts: number;
  shares: number;
  awaitingRec: number;
  overdue: number;
}
function aggByMgr(rows: Row[]): Map<string, MgrAgg> {
  const m = new Map<string, MgrAgg>();
  const contractsByMgr = new Map<string, Set<string>>();
  rows.forEach((r) => {
    const mgr = r.account_mgr ?? "(미지정)";
    const a = m.get(mgr) ?? { mgr, contracts: 0, shares: 0, awaitingRec: 0, overdue: 0 };
    a.shares += 1;
    if (!r.rec_date) a.awaitingRec += 1;
    if (r.ppw && r.ppw < TODAY && !r.rec_date) a.overdue += 1;
    m.set(mgr, a);
    (contractsByMgr.get(mgr) ?? contractsByMgr.set(mgr, new Set()).get(mgr)!).add(contractKey(r));
  });
  contractsByMgr.forEach((set, mgr) => {
    const a = m.get(mgr);
    if (a) a.contracts = set.size;
  });
  return m;
}
function ManagerView({ rows, prevRows, prevId }: { rows: Row[]; prevRows: Row[]; prevId: string | null }) {
  const { list, prev } = useMemo(() => {
    const cur = aggByMgr(rows);
    const prev = aggByMgr(prevRows);
    // Sort by contract count — the truer workload measure. Share count
    // inflates a manager who owns treaty/surplus contracts (many reinsurer
    // shares per contract), so it overstates their relative load.
    return {
      list: [...cur.values()].sort((a, b) => b.contracts - a.contracts || b.shares - a.shares),
      prev,
    };
  }, [rows, prevRows]);

  return (
    <section>
      <Legend>
        담당자별 진행 현황 · 계약 수 기준 정렬(부하의 정확한 척도; shares는 계약당 재보험사 수만큼 부풀려짐)
        {prevId ? <> · WoW = 직전 스냅샷({prevId}) 대비 미수금 share 증감</> : <> · WoW는 스냅샷 2개 이상부터 표시</>}.
      </Legend>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>담당</Th><Th right>계약</Th><Th right>Shares</Th>
            <Th right>수금대기</Th><Th right>PPW 연체</Th><Th right>WoW(수금대기)</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((a) => {
            const p = prev.get(a.mgr);
            const delta = p ? a.awaitingRec - p.awaitingRec : null;
            return (
              <tr key={a.mgr} className="hover:bg-slate-50">
                <Td>{a.mgr}</Td>
                <Td right>{a.contracts}</Td>
                <Td right>{a.shares}</Td>
                <Td right><Count n={a.awaitingRec} tone={a.awaitingRec ? "amber" : "slate"} /></Td>
                <Td right><Count n={a.overdue} tone={a.overdue ? "red" : "slate"} /></Td>
                <Td right>
                  {delta === null ? (
                    <span className="text-slate-300">—</span>
                  ) : delta === 0 ? (
                    <span className="text-slate-400">0</span>
                  ) : (
                    <span className={delta < 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>
                      {delta < 0 ? "▼" : "▲"} {Math.abs(delta)}
                    </span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ─── small UI atoms ──────────────────────────────────────────────────────
function Legend({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">{children}</p>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-400 border border-dashed border-slate-200 px-4 py-6 text-center">{children}</p>;
}
function More({ n }: { n: number }) {
  return <p className="text-[10px] text-slate-400 mt-2">… 외 {n.toLocaleString()}건 (상위 300건만 표시)</p>;
}
function Pill({ children, tone }: { children: React.ReactNode; tone: "red" | "amber" }) {
  const c = tone === "red" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c}`}>{children}</span>;
}
