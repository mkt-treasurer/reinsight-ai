"use client";

// Weekly Result & Plan dashboard — reads internal staff weekly reports and
// renders an overall work-progress view. Self-contained / experimental: talks
// only to the isolated /api/tools/weekly backend (no DB), mirroring rq-slip.
//
// Upload one or more 취합본/personal .xlsx weekly reports → they accumulate
// week-over-week. Four views: progress tracking, by business line, by handler,
// and financial roll-up (numeric cells only — free-text amounts are excluded
// and counted, never silently summed).
//
// Styling follows DESIGN.md: slate palette + single red accent, sharp corners
// (rounding only on tiny dots/pills), no colored card fills, no emoji.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";
const BASE = `${API_URL}/api/tools/weekly`;

// ─── types ────────────────────────────────────────────────────────────────
interface Deal {
  line: string;
  line_code: string;
  status: string; // Completed | In Progress
  category: string; // Renewal | New | Retail
  inception: string;
  type: string;
  account: string;
  retail_re: string;
  insurer: string;
  cedent: string;
  share_2025: number | null;
  prem_2025_raw: string;
  prem_2025_num: number | null;
  brk_2025_num: number | null;
  share_2026: number | null;
  prem_2026_raw: string;
  prem_2026_num: number | null;
  brk_2026_num: number | null;
  handler: string;
  handler_name: string;
  remark: string;
}
interface Week {
  week_id: string;
  week_start: string | null;
  week_end: string | null;
  source: string;
  filename: string;
  deal_count: number;
  deals: Deal[];
}
interface UploadResult {
  filename: string;
  status: string;
  reason?: string;
  week_id?: string;
  deal_count?: number;
  source?: string;
}

// ─── constants ──────────────────────────────────────────────────────────────
const LINE_ORDER = ["C", "T", "P", "M", "G", "E"];
const LINE_LABEL: Record<string, string> = {
  C: "Casualty",
  T: "Treaty",
  P: "Property",
  M: "Marine",
  G: "Global/Retail",
  E: "Engineering",
};
// Slate ramp — single-accent rule (DESIGN.md). No rainbow categorical hues.
const LINE_SHADE: Record<string, string> = {
  C: "#0f172a",
  T: "#334155",
  P: "#475569",
  M: "#64748b",
  G: "#94a3b8",
  E: "#cbd5e1",
};
const CAT_SHADE: Record<string, string> = {
  Renewal: "#0f172a",
  New: "#64748b",
  Retail: "#cbd5e1",
};
const TABS = [
  { key: "progress", label: "진행상황 추적" },
  { key: "line", label: "사업라인별 현황" },
  { key: "handler", label: "담당자별 업무량" },
  { key: "financial", label: "실적 집계" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// recharts shared props (DESIGN.md chart spec)
const GRID = { stroke: "#f1f5f9", strokeDasharray: "2 2", vertical: false } as const;
const TICK = { fontSize: 10, fill: "#64748b" } as const;
const TOOLTIP_STYLE = { fontSize: 10, border: "1px solid #e2e8f0", borderRadius: 0, padding: "4px 8px" } as const;

// ─── helpers ──────────────────────────────────────────────────────────────
function fmtKRW(v: number): string {
  if (!v) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `₩${(v / 1e12).toFixed(2)}조`;
  if (abs >= 1e8) return `₩${(v / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `₩${(v / 1e4).toFixed(0)}만`;
  return `₩${v.toLocaleString()}`;
}
function weekLabel(w: Week): string {
  if (w.week_start && w.week_end) {
    return `${w.week_start.slice(5)} ~ ${w.week_end.slice(5)}`;
  }
  return w.filename.slice(0, 24);
}
function lineName(code: string): string {
  return LINE_LABEL[code] || code || "기타";
}

// ─── page ─────────────────────────────────────────────────────────────────
export default function WeeklyDashboardPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState<UploadResult[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [tab, setTab] = useState<TabKey>("progress");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/data`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const w: Week[] = json.weeks || [];
      setWeeks(w);
      setSelectedWeekId((prev) =>
        prev && w.some((x) => x.week_id === prev) ? prev : w.length ? w[w.length - 1].week_id : ""
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const doUpload = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;
      setUploading(true);
      setUploadLog([]);
      try {
        const fd = new FormData();
        arr.forEach((f) => fd.append("files", f));
        const res = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(`업로드 실패 (${res.status})`);
        const json = await res.json();
        setUploadLog(json.results || []);
        await loadData();
      } catch (e) {
        setError(e instanceof Error ? e.message : "업로드 실패");
      } finally {
        setUploading(false);
      }
    },
    [loadData]
  );

  const deleteWeek = useCallback(
    async (id: string) => {
      if (!confirm("이 주차 데이터를 삭제할까요?")) return;
      await fetch(`${BASE}/weeks/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadData();
    },
    [loadData]
  );

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.week_id === selectedWeekId) || null,
    [weeks, selectedWeekId]
  );
  const prevWeek = useMemo(() => {
    const idx = weeks.findIndex((w) => w.week_id === selectedWeekId);
    return idx > 0 ? weeks[idx - 1] : null;
  }, [weeks, selectedWeekId]);

  const deals = selectedWeek?.deals || [];

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      {/* masthead */}
      <div className="border-b border-slate-900 px-6 py-4 flex items-center gap-6 bg-slate-900 text-white flex-wrap">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em] uppercase">
            Weekly Result &amp; Plan
          </div>
          <div className="text-[10px] text-slate-400 tracking-wider">내부 업무 진행 대시보드</div>
        </div>
        <div className="flex items-center gap-3 ml-auto text-[10px] font-mono tabular-nums text-slate-300">
          {weeks.length > 0 && (
            <select
              value={selectedWeekId}
              onChange={(e) => setSelectedWeekId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-[11px] px-2 py-1"
            >
              {weeks.map((w) => (
                <option key={w.week_id} value={w.week_id}>
                  {weekLabel(w)} · {w.deal_count}건{w.source === "consolidated" ? " · 취합본" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="bg-[#b91c1c] hover:bg-[#991b1b] disabled:opacity-50 text-white text-[10px] uppercase tracking-[0.15em] font-semibold px-3 py-1.5 transition-colors"
          >
            {uploading ? "처리 중…" : "엑셀 업로드"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xlsm"
            multiple
            hidden
            onChange={(e) => e.target.files && doUpload(e.target.files)}
          />
        </div>
      </div>

      <div className="px-6 py-5">
        {error && (
          <div className="mb-4 text-[11px] text-[#b91c1c] border border-[#b91c1c]/40 px-3 py-2">
            {error}
          </div>
        )}

        {/* upload dropzone + log — always available */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            doUpload(e.dataTransfer.files);
          }}
          className={`mb-5 border border-dashed px-4 py-3 text-center text-[11px] transition-colors ${
            dragging ? "border-[#b91c1c] text-[#b91c1c]" : "border-slate-300 text-slate-400 hover:border-slate-400"
          }`}
        >
          주간 보고서 .xlsx 파일을 여기로 드래그하세요 (취합본·개인 파일 모두, 여러 개 동시 가능)
          {uploadLog.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {uploadLog.map((r, i) => (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 text-[9px] font-mono border ${
                    r.status === "stored"
                      ? "text-emerald-700 border-emerald-300"
                      : r.status === "error"
                      ? "text-[#b91c1c] border-[#b91c1c]/40"
                      : "text-slate-500 border-slate-200"
                  }`}
                >
                  {r.filename.slice(0, 22)}: {r.status}
                  {r.deal_count != null ? ` (${r.deal_count})` : ""}
                  {r.reason ? ` — ${r.reason}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="min-h-[40vh] grid place-items-center text-[10px] uppercase tracking-[0.3em] text-slate-400">
            로딩 중…
          </div>
        ) : weeks.length === 0 ? (
          <EmptyState onPick={() => fileInput.current?.click()} />
        ) : (
          <>
            <KpiStrip deals={deals} prevWeek={prevWeek} weekCount={weeks.length} />

            {/* tabs — segmented control */}
            <div className="flex items-center border border-slate-300 w-fit mb-5 mt-5">
              {TABS.map((t, i) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                    i > 0 ? "border-l border-slate-300" : ""
                  } ${tab === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "progress" && (
              <ProgressView deals={deals} weeks={weeks} selectedWeek={selectedWeek} />
            )}
            {tab === "line" && <LineView deals={deals} prevWeek={prevWeek} />}
            {tab === "handler" && <HandlerView deals={deals} />}
            {tab === "financial" && <FinancialView deals={deals} />}

            <WeekManager weeks={weeks} onDelete={deleteWeek} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── KPI strip ──────────────────────────────────────────────────────────────
function KpiStrip({
  deals,
  prevWeek,
  weekCount,
}: {
  deals: Deal[];
  prevWeek: Week | null;
  weekCount: number;
}) {
  const completed = deals.filter((d) => d.status === "Completed").length;
  const inProgress = deals.filter((d) => d.status === "In Progress").length;
  const newDeals = deals.filter((d) => d.category === "New").length;
  const prevTotal = prevWeek?.deals.length ?? null;
  const delta = prevTotal != null ? deals.length - prevTotal : null;

  const items = [
    {
      label: "TOTAL",
      ko: "총 건수",
      value: deals.length,
      hint: delta != null ? `${delta >= 0 ? "+" : ""}${delta} vs 전주` : `${weekCount}개 주차`,
    },
    { label: "IN PROGRESS", ko: "진행 중", value: inProgress, hint: "진행 중" },
    { label: "COMPLETED", ko: "완료", value: completed, hint: "완료" },
    { label: "NEW PIPELINE", ko: "신규", value: newDeals, hint: "신규 건" },
  ];
  return (
    <div className="grid grid-cols-4 gap-px bg-slate-200 border border-slate-200">
      {items.map((it) => (
        <div key={it.label} className="bg-white px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase">
              {it.label}
            </span>
            <span className="text-[10px] text-slate-400">{it.ko}</span>
          </div>
          <div className="text-[32px] font-bold tabular-nums text-slate-900 leading-tight mt-0.5">
            {it.value}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{it.hint}</div>
        </div>
      ))}
    </div>
  );
}

// ─── shared card ──────────────────────────────────────────────────────────
function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-slate-200 bg-white ${className}`}>
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">{title}</span>
        {subtitle && <span className="text-[10px] text-slate-400">{subtitle}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── cross-week tracking helpers ────────────────────────────────────────────
type Movement = "new" | "completed" | "stalled" | "active";

// Identity of a deal across weeks: same line + same account name (normalised).
function accountKey(d: Deal): string {
  return `${d.line_code}|${d.account.trim().toLowerCase()}`;
}

interface TimelinePoint {
  weekId: string;
  label: string;
  status: string;
  remark: string;
  changed: boolean; // remark differs from the previous week's
}

// account key → chronological status/remark timeline across all loaded weeks.
function buildHistory(weeks: Week[]): Map<string, TimelinePoint[]> {
  const m = new Map<string, TimelinePoint[]>();
  for (const w of weeks) {
    for (const d of w.deals) {
      const k = accountKey(d);
      const list = m.get(k) ?? [];
      const prev = list[list.length - 1];
      list.push({
        weekId: w.week_id,
        label: weekLabel(w),
        status: d.status,
        remark: d.remark,
        changed: !prev || (prev.remark || "").trim() !== (d.remark || "").trim(),
      });
      m.set(k, list);
    }
  }
  return m;
}

// Classify a deal vs the previous week: 신규 / 완료 전환 / 정체 / 진행.
function classifyMovement(d: Deal, prevMap: Map<string, Deal>): Movement {
  const prev = prevMap.get(accountKey(d));
  if (d.status === "Completed") {
    return !prev || prev.status !== "Completed" ? "completed" : "active";
  }
  if (!prev) return "new";
  if (prev.status === "In Progress" && (prev.remark || "").trim() === (d.remark || "").trim()) {
    return "stalled";
  }
  return "active";
}

// ─── progress view ──────────────────────────────────────────────────────────
function ProgressView({
  deals,
  weeks,
  selectedWeek,
}: {
  deals: Deal[];
  weeks: Week[];
  selectedWeek: Week | null;
}) {
  const [q, setQ] = useState("");
  const [fLine, setFLine] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fHandler, setFHandler] = useState("");
  const [move, setMove] = useState<Movement | "">("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (k: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const handlers = useMemo(
    () => Array.from(new Set(deals.map((d) => d.handler).filter(Boolean))).sort(),
    [deals]
  );

  const history = useMemo(() => buildHistory(weeks), [weeks]);

  const prevWeek = useMemo(() => {
    const idx = weeks.findIndex((w) => w.week_id === selectedWeek?.week_id);
    return idx > 0 ? weeks[idx - 1] : null;
  }, [weeks, selectedWeek]);

  const prevMap = useMemo(() => {
    const m = new Map<string, Deal>();
    prevWeek?.deals.forEach((d) => m.set(accountKey(d), d));
    return m;
  }, [prevWeek]);

  const moveOf = useMemo(() => {
    const m = new Map<string, Movement>();
    deals.forEach((d) => m.set(accountKey(d), classifyMovement(d, prevMap)));
    return m;
  }, [deals, prevMap]);

  const counts = useMemo(() => {
    let n = 0,
      c = 0,
      s = 0;
    deals.forEach((d) => {
      const cls = moveOf.get(accountKey(d));
      if (cls === "new") n++;
      else if (cls === "completed") c++;
      else if (cls === "stalled") s++;
    });
    return { new: n, completed: c, stalled: s };
  }, [deals, moveOf]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return deals.filter((d) => {
      if (fLine && d.line_code !== fLine) return false;
      if (fStatus && d.status !== fStatus) return false;
      if (fHandler && d.handler !== fHandler) return false;
      if (move && moveOf.get(accountKey(d)) !== move) return false;
      if (needle) {
        const hay = `${d.account} ${d.type} ${d.insurer} ${d.cedent} ${d.remark}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [deals, q, fLine, fStatus, fHandler, move, moveOf]);

  const trend = useMemo(
    () =>
      weeks.map((w) => ({
        label: weekLabel(w),
        total: w.deals.length,
        완료: w.deals.filter((d) => d.status === "Completed").length,
        진행중: w.deals.filter((d) => d.status === "In Progress").length,
      })),
    [weeks]
  );

  const chips: { key: Movement | ""; label: string; n: number | null; alert?: boolean }[] = [
    { key: "", label: "전체", n: null },
    { key: "new", label: "신규", n: counts.new },
    { key: "completed", label: "완료 전환", n: counts.completed },
    { key: "stalled", label: "정체", n: counts.stalled, alert: counts.stalled > 0 },
  ];

  return (
    <div className="space-y-5">
      {weeks.length > 1 && (
        <Card title="WEEKLY TREND" subtitle="주차별 건수 추이">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" tick={TICK} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="total" stroke="#0f172a" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="진행중" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="완료" stroke="#059669" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
            PROGRESS · {filtered.length}건
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="계정·보종·Remark 검색"
              className="border border-slate-300 px-2 py-1 text-[11px] w-44"
            />
            <Select value={fLine} onChange={setFLine} placeholder="전체 라인">
              {LINE_ORDER.filter((c) => deals.some((d) => d.line_code === c)).map((c) => (
                <option key={c} value={c}>
                  {lineName(c)}
                </option>
              ))}
            </Select>
            <Select value={fStatus} onChange={setFStatus} placeholder="전체 상태">
              <option value="Completed">완료</option>
              <option value="In Progress">진행 중</option>
            </Select>
            <Select value={fHandler} onChange={setFHandler} placeholder="전체 담당">
              {handlers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* week-over-week movement filter (only when a previous week exists) */}
        {prevWeek && (
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              전주 대비 ({weekLabel(prevWeek)})
            </span>
            {chips.map((c) => {
              const active = move === c.key;
              const alert = c.alert;
              return (
                <button
                  key={c.key || "all"}
                  onClick={() => setMove(c.key)}
                  className={`px-2 py-1 text-[11px] uppercase tracking-wider border transition-colors ${
                    active
                      ? alert
                        ? "border-[#b91c1c] bg-[#b91c1c] text-white"
                        : "border-slate-900 bg-slate-900 text-white"
                      : alert
                      ? "border-[#b91c1c]/40 text-[#b91c1c] hover:bg-[#b91c1c]/5"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c.label}
                  {c.n != null && <span className="ml-1 font-mono tabular-nums">{c.n}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-white border-b border-slate-200">
                <th className="py-2 px-3 font-semibold">라인</th>
                <th className="py-2 px-3 font-semibold">상태</th>
                <th className="py-2 px-3 font-semibold">구분</th>
                <th className="py-2 px-3 font-semibold">계정</th>
                <th className="py-2 px-3 font-semibold">보종</th>
                <th className="py-2 px-3 font-semibold">원수사</th>
                <th className="py-2 px-3 font-semibold">담당</th>
                <th className="py-2 px-3 font-semibold">진행상황 (Remark)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const k = accountKey(d);
                const cls = moveOf.get(k);
                const tl = history.get(k) ?? [];
                const expandable = tl.length > 1;
                const isOpen = open.has(k);
                return (
                  <Fragment key={`${k}-${i}`}>
                    <tr
                      className={`border-b border-slate-100 hover:bg-slate-50 ${isOpen ? "bg-slate-50" : ""}`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className="inline-block w-[6px] h-[6px] rounded-full mr-1.5 align-middle"
                          style={{ background: LINE_SHADE[d.line_code] || "#94a3b8" }}
                        />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">
                          {d.line_code}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <StatusPill status={d.status} />
                          {cls === "new" && (
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 border border-slate-300 px-1">
                              신규
                            </span>
                          )}
                          {cls === "completed" && (
                            <span className="text-[9px] uppercase tracking-wider text-emerald-700 border border-emerald-300 px-1">
                              전환
                            </span>
                          )}
                          {cls === "stalled" && (
                            <span className="text-[9px] uppercase tracking-wider text-[#b91c1c] border border-[#b91c1c]/40 px-1">
                              정체
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[10px] uppercase tracking-wider text-slate-600">
                        {d.category}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900 max-w-[220px]">
                        {expandable ? (
                          <button
                            onClick={() => toggle(k)}
                            className="flex items-center gap-1 text-left hover:text-[#1e40af] truncate w-full"
                            title={`${d.account} — 주차별 이력 보기`}
                          >
                            <span className="font-mono text-[9px] text-slate-400 w-2">
                              {isOpen ? "−" : "+"}
                            </span>
                            <span className="truncate">{d.account}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{tl.length}w</span>
                          </button>
                        ) : (
                          <span className="truncate block" title={d.account}>
                            {d.account}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{d.type || "—"}</td>
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{d.insurer || "—"}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-slate-700">{d.handler || "—"}</span>
                        {d.handler_name && d.handler_name !== d.handler && (
                          <span className="text-[10px] text-slate-400 ml-1">{d.handler_name}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-[340px] text-[11px]">{d.remark || "—"}</td>
                    </tr>
                    {isOpen && expandable && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={8} className="px-3 pb-3 pt-0">
                          <AccountTimeline points={tl} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[11px] text-slate-400">
                    조건에 맞는 건이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selectedWeek && (
          <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            {selectedWeek.filename}
          </div>
        )}
      </div>
    </div>
  );
}

// Cross-week remark/status timeline for one account. Weeks where the remark
// changed are inked dark; carried-over (unchanged) weeks are muted.
function AccountTimeline({ points }: { points: TimelinePoint[] }) {
  return (
    <div className="ml-4 border-l border-slate-300 pl-3 pt-1">
      {points.map((p, i) => (
        <div key={p.weekId} className="flex items-start gap-2 py-1">
          <span className="text-[10px] font-mono tabular-nums text-slate-400 w-24 shrink-0">{p.label}</span>
          <StatusPill status={p.status} />
          <span
            className={`text-[11px] ${
              p.changed ? "text-slate-700" : "text-slate-400"
            }`}
          >
            {p.remark || "—"}
            {!p.changed && i > 0 && (
              <span className="ml-1.5 text-[9px] uppercase tracking-wider text-slate-400">변동 없음</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── by-line view ─────────────────────────────────────────────────────────
function LineView({ deals, prevWeek }: { deals: Deal[]; prevWeek: Week | null }) {
  const codes = useMemo(
    () => LINE_ORDER.filter((c) => deals.some((d) => d.line_code === c)),
    [deals]
  );
  const byLine = useMemo(
    () =>
      codes.map((c) => {
        const ld = deals.filter((d) => d.line_code === c);
        const prev = prevWeek?.deals.filter((d) => d.line_code === c).length ?? null;
        return {
          code: c,
          label: lineName(c),
          갱신: ld.filter((d) => d.category === "Renewal").length,
          신규: ld.filter((d) => d.category === "New").length,
          리테일: ld.filter((d) => d.category === "Retail").length,
          completed: ld.filter((d) => d.status === "Completed").length,
          total: ld.length,
          delta: prev != null ? ld.length - prev : null,
        };
      }),
    [codes, deals, prevWeek]
  );

  return (
    <div className="space-y-5">
      <Card title="COMPOSITION BY LINE" subtitle="갱신 / 신규 / 리테일">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byLine} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" tick={TICK} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="갱신" stackId="a" fill={CAT_SHADE.Renewal} />
              <Bar dataKey="신규" stackId="a" fill={CAT_SHADE.New} />
              <Bar dataKey="리테일" stackId="a" fill={CAT_SHADE.Retail} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-slate-200 border border-slate-200">
        {byLine.map((l) => (
          <div key={l.code} className="bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-block w-[8px] h-[8px] rounded-full"
                style={{ background: LINE_SHADE[l.code] || "#94a3b8" }}
              />
              <span className="text-[12px] font-bold text-slate-900">{l.label}</span>
              <span className="ml-auto text-[22px] font-bold tabular-nums text-slate-900">{l.total}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              갱신 {l.갱신} · 신규 {l.신규} · 리테일 {l.리테일}
            </div>
            <div className="flex items-center justify-between text-[10px] mt-1.5">
              <span className="text-emerald-700 font-semibold">완료 {l.completed}</span>
              {l.delta != null && (
                <span className={l.delta >= 0 ? "text-slate-400" : "text-[#b91c1c]"}>
                  {l.delta >= 0 ? "+" : ""}
                  {l.delta} vs 전주
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── by-handler view ─────────────────────────────────────────────────────────
function HandlerView({ deals }: { deals: Deal[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const d of deals) {
      if (!d.handler) continue;
      if (!map.has(d.handler)) map.set(d.handler, []);
      map.get(d.handler)!.push(d);
    }
    return Array.from(map.entries())
      .map(([handler, hd]) => ({
        handler,
        name: hd[0].handler_name,
        total: hd.length,
        completed: hd.filter((d) => d.status === "Completed").length,
        inProgress: hd.filter((d) => d.status === "In Progress").length,
        newDeals: hd.filter((d) => d.category === "New").length,
        lines: LINE_ORDER.filter((c) => hd.some((d) => d.line_code === c)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [deals]);

  const chart = rows.map((r) => ({ label: r.handler, 건수: r.total, 완료: r.completed }));

  return (
    <div className="space-y-5">
      <Card title="WORKLOAD BY HANDLER" subtitle="담당자별 건수">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" tick={TICK} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="건수" fill="#0f172a" />
              <Bar dataKey="완료" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
              <th className="py-2 px-3 font-semibold">담당</th>
              <th className="py-2 px-3 font-semibold text-right">총 건수</th>
              <th className="py-2 px-3 font-semibold text-right">진행 중</th>
              <th className="py-2 px-3 font-semibold text-right">완료</th>
              <th className="py-2 px-3 font-semibold text-right">신규</th>
              <th className="py-2 px-3 font-semibold text-right">완료율</th>
              <th className="py-2 px-3 font-semibold">담당 라인</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.handler} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="py-2 px-3">
                  <span className="font-mono font-semibold text-slate-900">{r.handler}</span>
                  {r.name && r.name !== r.handler && (
                    <span className="text-[11px] text-slate-500 ml-1.5">{r.name}</span>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">{r.total}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-[#b45309]">{r.inProgress}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">{r.completed}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">{r.newDeals}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                  {r.total ? Math.round((r.completed / r.total) * 100) : 0}%
                </td>
                <td className="py-2 px-3">
                  <div className="flex gap-1">
                    {r.lines.map((c) => (
                      <span
                        key={c}
                        title={lineName(c)}
                        className="text-[9px] font-mono px-1 py-0.5 text-white"
                        style={{ background: LINE_SHADE[c] || "#94a3b8" }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── financial view ─────────────────────────────────────────────────────────
function FinancialView({ deals }: { deals: Deal[] }) {
  const stats = useMemo(() => {
    const sum = (sel: (d: Deal) => number | null) => deals.reduce((acc, d) => acc + (sel(d) ?? 0), 0);
    const cnt = (sel: (d: Deal) => number | null) => deals.filter((d) => sel(d) != null).length;
    const premText = deals.filter(
      (d) => d.prem_2026_num == null && d.prem_2026_raw && d.prem_2026_raw !== "-"
    ).length;
    return {
      prem25: sum((d) => d.prem_2025_num),
      prem26: sum((d) => d.prem_2026_num),
      brk25: sum((d) => d.brk_2025_num),
      brk26: sum((d) => d.brk_2026_num),
      prem25n: cnt((d) => d.prem_2025_num),
      prem26n: cnt((d) => d.prem_2026_num),
      brk26n: cnt((d) => d.brk_2026_num),
      premText,
    };
  }, [deals]);

  const byLineBrk = useMemo(() => {
    const codes = LINE_ORDER.filter((c) => deals.some((d) => d.line_code === c));
    return codes.map((c) => ({
      label: lineName(c),
      code: c,
      "수수료'25": deals.filter((d) => d.line_code === c).reduce((a, d) => a + (d.brk_2025_num ?? 0), 0),
      "수수료'26": deals.filter((d) => d.line_code === c).reduce((a, d) => a + (d.brk_2026_num ?? 0), 0),
    }));
  }, [deals]);

  const detail = deals.filter(
    (d) => d.prem_2026_num != null || d.brk_2026_num != null || (d.prem_2026_raw && d.prem_2026_raw !== "-")
  );

  return (
    <div className="space-y-5">
      <div className="text-[11px] text-[#b45309] border border-[#b45309]/40 px-3 py-2">
        금액은 숫자로 입력된 셀(원화)만 합산합니다. &quot;USD 70,000&quot;, &quot;약 2억&quot; 등 자유텍스트·외화 표기
        {stats.premText > 0 && <span className="font-semibold"> {stats.premText}건</span>}은 집계에서 제외됩니다.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200">
        <FinKpi label="PREMIUM '26" ko="2026 보험료" value={fmtKRW(stats.prem26)} hint={`${stats.prem26n}건 합산`} />
        <FinKpi label="PREMIUM '25" ko="2025 보험료" value={fmtKRW(stats.prem25)} hint={`${stats.prem25n}건 합산`} />
        <FinKpi label="BROKERAGE '26" ko="2026 수수료" value={fmtKRW(stats.brk26)} hint={`${stats.brk26n}건 합산`} />
        <FinKpi label="BROKERAGE '25" ko="2025 수수료" value={fmtKRW(stats.brk25)} hint="전년 수수료" />
      </div>

      <Card title="BROKERAGE BY LINE" subtitle="숫자 셀 합산 · 원화">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byLineBrk} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" tick={TICK} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtKRW} width={64} />
              <Tooltip formatter={(v) => fmtKRW(Number(v))} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="수수료'25" fill="#cbd5e1" />
              <Bar dataKey="수수료'26">
                {byLineBrk.map((e) => (
                  <Cell key={e.code} fill={LINE_SHADE[e.code] || "#0f172a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
          AMOUNTS · 금액 기재 건 ({detail.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-2 px-3 font-semibold">라인</th>
                <th className="py-2 px-3 font-semibold">계정</th>
                <th className="py-2 px-3 font-semibold text-right">100% 보험료 &apos;26</th>
                <th className="py-2 px-3 font-semibold text-right">수수료 &apos;26</th>
                <th className="py-2 px-3 font-semibold">담당</th>
              </tr>
            </thead>
            <tbody>
              {detail.map((d, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-2 px-3 text-[10px] uppercase text-slate-500">{d.line_code}</td>
                  <td className="py-2 px-3 font-semibold text-slate-900 max-w-[240px] truncate" title={d.account}>
                    {d.account}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {d.prem_2026_num != null ? (
                      fmtKRW(d.prem_2026_num)
                    ) : (
                      <span className="text-[#b45309] text-[11px]">{d.prem_2026_raw}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {d.brk_2026_num != null ? fmtKRW(d.brk_2026_num) : "—"}
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{d.handler}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FinKpi({ label, ko, value, hint }: { label: string; ko: string; value: string; hint: string }) {
  return (
    <div className="bg-white px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase">{label}</span>
        <span className="text-[10px] text-slate-400">{ko}</span>
      </div>
      <div className="text-[22px] font-bold tabular-nums leading-tight mt-0.5 text-slate-900">{value}</div>
      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{hint}</div>
    </div>
  );
}

// ─── week manager ─────────────────────────────────────────────────────────
function WeekManager({ weeks, onDelete }: { weeks: Week[]; onDelete: (id: string) => void }) {
  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-2">
        LOADED WEEKS · 불러온 주차 ({weeks.length})
      </div>
      <div className="flex flex-wrap gap-2">
        {weeks.map((w) => (
          <div key={w.week_id} className="flex items-center gap-2 border border-slate-200 px-2.5 py-1 text-[11px]">
            <span className="font-mono text-slate-700">{weekLabel(w)}</span>
            <span className="text-slate-400">{w.deal_count}건</span>
            {w.source === "consolidated" && (
              <span className="text-[9px] uppercase tracking-wider text-emerald-700">취합본</span>
            )}
            <button
              onClick={() => onDelete(w.week_id)}
              className="text-slate-300 hover:text-[#b91c1c] transition-colors text-[11px] uppercase tracking-wider"
              title="삭제"
            >
              DEL
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── small bits ───────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const done = status === "Completed";
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${
        done ? "bg-slate-100 text-emerald-700" : "bg-slate-100 text-slate-700"
      }`}
    >
      {done ? "완료" : "진행"}
    </span>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-slate-300 px-2 py-1 text-[11px] bg-white text-slate-700"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="min-h-[40vh] grid place-items-center">
      <div className="text-center">
        <div className="text-[13px] font-semibold text-slate-700 mb-1">
          아직 불러온 주간 보고서가 없습니다
        </div>
        <div className="text-[11px] text-slate-400 mb-4">
          취합본 또는 개인 Weekly Report .xlsx 파일을 업로드하면 대시보드가 생성됩니다
        </div>
        <button
          onClick={onPick}
          className="bg-[#b91c1c] hover:bg-[#991b1b] text-white text-[11px] uppercase tracking-[0.15em] font-semibold px-4 py-2 transition-colors"
        >
          엑셀 업로드
        </button>
      </div>
    </div>
  );
}
