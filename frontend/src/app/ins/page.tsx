"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchApi,
  DashboardAttention,
  AttentionRow,
  FunnelPipeline,
} from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

function formatKRW(v: number): string {
  if (!v) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}조`;
  if (abs >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toLocaleString();
}

const STAGE_LABEL: Record<string, string> = {
  intake: "Intake",
  analyzed: "Analyzed",
  draft_ready: "Draft",
  review: "Review",
  sent: "Sent",
  awaiting_payment: "Awaiting",
  payment_received: "Received",
  completed: "Completed",
};

function sevDot(sev: string) {
  if (sev === "critical") return "bg-[#b91c1c]";
  if (sev === "warning") return "bg-[#b45309]";
  return "bg-slate-400";
}
function sevText(sev: string) {
  if (sev === "critical") return "text-[#b91c1c]";
  if (sev === "warning") return "text-[#b45309]";
  return "text-slate-500";
}

function rowHref(r: AttentionRow): string {
  if (r.kind === "claim" || r.kind === "claim_draft")
    return `/ins/claims?case=${r.case_id}`;
  return `/ins/contracts?case=${r.case_id}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardAttention | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<"severity" | "days" | "amount">(
    "severity"
  );
  const [filter, setFilter] = useState<"all" | "claim" | "contract">("all");

  useEffect(() => {
    fetchApi<DashboardAttention>("/api/dashboard/attention")
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sortedQueue = useMemo(() => {
    if (!data) return [];
    const sev = { critical: 0, warning: 1, info: 2 } as const;
    let q = data.queue.filter((r) => {
      if (filter === "all") return true;
      return r.kind.startsWith(filter);
    });
    q = [...q];
    if (sortKey === "severity")
      q.sort((a, b) => sev[a.severity] - sev[b.severity] || b.days - a.days);
    else if (sortKey === "days") q.sort((a, b) => b.days - a.days);
    else q.sort((a, b) => b.amount_krw - a.amount_krw);
    return q;
  }, [data, sortKey, filter]);

  if (loading)
    return (
      <div className="min-h-[60vh] grid place-items-center text-[10px] uppercase tracking-[0.3em] text-slate-400">
        Loading
      </div>
    );
  if (!data)
    return (
      <div className="min-h-[60vh] grid place-items-center text-[10px] uppercase tracking-[0.3em] text-[#b91c1c]">
        Failed to load
      </div>
    );

  const { kpi, funnels, hotspots } = data;

  // Derived chart data from queue
  const sevDist = [
    {
      name: "Critical",
      value: data.queue.filter((r) => r.severity === "critical").length,
      fill: "#b91c1c",
    },
    {
      name: "Warning",
      value: data.queue.filter((r) => r.severity === "warning").length,
      fill: "#b45309",
    },
    {
      name: "Info",
      value: data.queue.filter((r) => r.severity === "info").length,
      fill: "#64748b",
    },
  ];

  const ageBuckets = [
    { range: "3–6d", count: data.queue.filter((r) => r.days >= 3 && r.days <= 6).length },
    { range: "7–13d", count: data.queue.filter((r) => r.days >= 7 && r.days <= 13).length },
    { range: "14–29d", count: data.queue.filter((r) => r.days >= 14 && r.days <= 29).length },
    { range: "30d+", count: data.queue.filter((r) => r.days >= 30).length },
  ];

  const kindMix = [
    { name: "Claim stuck", value: data.queue.filter((r) => r.kind === "claim").length },
    { name: "Contract stuck", value: data.queue.filter((r) => r.kind === "contract").length },
    { name: "Claim unpaid", value: data.queue.filter((r) => r.kind === "claim_draft").length },
    { name: "Contract unpaid", value: data.queue.filter((r) => r.kind === "contract_draft").length },
  ];

  // Cumulative exposure curve (sorted by amount desc, cumulative sum)
  const sortedAmounts = [...data.queue]
    .sort((a, b) => b.amount_krw - a.amount_krw)
    .slice(0, 20);
  let cum = 0;
  const exposureCurve = sortedAmounts.map((r, i) => {
    cum += r.amount_krw;
    return { idx: i + 1, cum };
  });
  const now = new Date();
  const dateLabel = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      {/* Ticker / Masthead */}
      <div className="border-b border-slate-900 px-6 py-4 flex items-center gap-6 bg-slate-900 text-white">
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase">
            Overview
          </span>
          <span className="text-[10px] text-slate-400 tracking-wider">
            Reinsurance Operations Desk
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-5 text-[10px] font-mono tabular-nums text-slate-300">
          <span>
            <span className="text-slate-500 mr-1">DATE</span>
            {dateLabel}
          </span>
          <span>
            <span className="text-slate-500 mr-1">SESSION</span>
            {now.toLocaleTimeString("ko-KR", { hour12: false })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-px bg-slate-200 border border-slate-200 mb-5">
          <Kpi
            label="STUCK CASES"
            sublabel="정체 > 3일"
            value={kpi.stuck_cases}
            hint="no update"
            severe={kpi.stuck_cases > 0}
          />
          <Kpi
            label="UNPAID NOTIFS"
            sublabel="미입금 통보"
            value={kpi.unpaid_notifications}
            hint="sent > 14d"
            severe={kpi.unpaid_notifications > 0}
          />
          <Kpi
            label="PENDING MATCH"
            sublabel="증권 미매칭"
            value={kpi.pending_match}
            hint="intake queue"
          />
          <Kpi
            label="NEW TODAY"
            sublabel="금일 신규"
            value={kpi.new_today}
            hint="fresh intake"
            tone="positive"
          />
        </div>

        {/* Analytics row */}
        <div className="grid grid-cols-12 gap-5 mb-5">
          <Card
            className="col-span-3"
            title="SEVERITY MIX"
            subtitle="위험도 분포"
          >
            <div className="h-[160px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sevDist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={62}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {sevDist.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontSize: 10,
                      border: "1px solid #e2e8f0",
                      borderRadius: 0,
                      padding: "4px 8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[10px] -mt-2">
              {sevDist.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2"
                    style={{ background: d.fill as string }}
                  />
                  <span className="text-slate-600">{d.name}</span>
                  <span className="ml-auto font-mono tabular-nums">
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            className="col-span-3"
            title="AGE DISTRIBUTION"
            subtitle="정체 일수 분포"
          >
            <div className="h-[190px]">
              <ResponsiveContainer>
                <BarChart data={ageBuckets} margin={{ top: 10, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid
                    strokeDasharray="2 2"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 10,
                      border: "1px solid #e2e8f0",
                      borderRadius: 0,
                      padding: "4px 8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 0, 0, 0]}>
                    {ageBuckets.map((b, i) => (
                      <Cell
                        key={i}
                        fill={
                          b.range === "30d+"
                            ? "#b91c1c"
                            : b.range === "14–29d"
                            ? "#b45309"
                            : "#475569"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            className="col-span-3"
            title="CASE TYPE MIX"
            subtitle="유형별 건수"
          >
            <div className="h-[190px]">
              <ResponsiveContainer>
                <BarChart
                  data={kindMix}
                  layout="vertical"
                  margin={{ top: 4, right: 10, bottom: 4, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="2 2"
                    stroke="#f1f5f9"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 10, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 10,
                      border: "1px solid #e2e8f0",
                      borderRadius: 0,
                      padding: "4px 8px",
                    }}
                  />
                  <Bar dataKey="value" fill="#0f172a" radius={[0, 0, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            className="col-span-3"
            title="EXPOSURE CURVE"
            subtitle="누적 노출액 (상위 20건)"
          >
            <div className="h-[190px]">
              <ResponsiveContainer>
                <LineChart
                  data={exposureCurve}
                  margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
                >
                  <CartesianGrid
                    strokeDasharray="2 2"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="idx"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1e8
                        ? `${(v / 1e8).toFixed(0)}억`
                        : v >= 1e4
                        ? `${(v / 1e4).toFixed(0)}만`
                        : String(v)
                    }
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 10,
                      border: "1px solid #e2e8f0",
                      borderRadius: 0,
                      padding: "4px 8px",
                    }}
                    formatter={(v) => [`₩${formatKRW(Number(v))}`, "cum"] as [string, string]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cum"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Funnels + Hotspots */}
        <div className="grid grid-cols-12 gap-5 mb-5">
          <Card className="col-span-8" title="WORKFLOW PIPELINE" subtitle="업무 단계별 분포">
            <div className="space-y-5">
              {funnels.map((f) => (
                <Funnel key={f.kind} pipe={f} />
              ))}
            </div>
          </Card>

          <Card
            className="col-span-4"
            title="REINSURER EXPOSURE"
            subtitle="미입금 상위"
          >
            {hotspots.length === 0 ? (
              <EmptyLine text="No overdue exposure." />
            ) : (
              <div className="space-y-2.5">
                {hotspots.map((h, i) => {
                  const max = Math.max(
                    ...hotspots.map((x) => x.unpaid_amount_krw)
                  );
                  const pct = max ? (h.unpaid_amount_krw / max) * 100 : 0;
                  return (
                    <div key={h.reinsurer}>
                      <div className="flex items-baseline justify-between text-[11px] mb-1">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-400 font-mono w-4">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate font-semibold">
                            {h.reinsurer}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-900">
                          ₩{formatKRW(h.unpaid_amount_krw)}
                        </span>
                      </div>
                      <div className="h-[4px] bg-slate-100 relative">
                        <div
                          className="h-full bg-[#b91c1c] transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                        {h.unpaid_count} notifs
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Queue */}
        <div className="border border-slate-200">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
                Attention Queue
              </span>
              <span className="text-[10px] text-slate-400">
                총 {sortedQueue.length}건
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { v: "all", label: "ALL" },
                  { v: "claim", label: "CLAIM" },
                  { v: "contract", label: "CONTRACT" },
                ]}
              />
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400">
                <span className="mr-1">Sort</span>
                {(["severity", "days", "amount"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSortKey(k)}
                    className={`px-2 py-1 border ${
                      sortKey === k
                        ? "border-slate-900 text-slate-900 bg-white"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {sortedQueue.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-[12px] text-slate-500 font-semibold">
                All clear
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mt-1">
                조치 필요 항목 없음
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-white border-b border-slate-200">
                    <th className="py-2 px-4 w-6" />
                    <th className="py-2 pr-3 w-14">Type</th>
                    <th className="py-2 pr-3">Ref</th>
                    <th className="py-2 pr-3">Counterparty</th>
                    <th className="py-2 pr-3">Stage</th>
                    <th className="py-2 pr-3 text-right w-16">Days</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-4 text-right w-24">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedQueue.map((r, idx) => (
                    <tr
                      key={`${r.kind}-${r.case_id}-${idx}`}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors animate-row-in"
                      style={{ animationDelay: `${Math.min(idx * 15, 450)}ms` }}
                    >
                      <td className="py-2 px-4">
                        <span
                          className={`block w-[6px] h-[6px] rounded-full ${sevDot(
                            r.severity
                          )} ${
                            r.severity === "critical"
                              ? "animate-pulse-dot"
                              : ""
                          }`}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                          {r.kind.includes("claim") ? "CL" : "CT"}
                          {r.kind.endsWith("draft") ? "·$" : ""}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <Link
                          href={rowHref(r)}
                          className="font-mono text-[12px] font-semibold text-slate-900 hover:text-[#1e40af] hover:underline underline-offset-2"
                        >
                          {r.ref}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-[12px] truncate max-w-[220px] text-slate-700">
                        {r.counterparty}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5">
                          {STAGE_LABEL[r.stage] || r.stage}
                        </span>
                      </td>
                      <td
                        className={`py-2 pr-3 text-right font-mono text-[12px] tabular-nums font-semibold ${sevText(
                          r.severity
                        )}`}
                      >
                        {r.days}d
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-[12px] tabular-nums text-slate-900">
                        ₩{formatKRW(r.amount_krw)}
                      </td>
                      <td className="py-2 pr-4 text-right text-[11px] text-slate-500">
                        {r.assignee || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 text-[10px] uppercase tracking-wider text-slate-400">
          <span>InsightRe · Reinsurance Ops</span>
          <span className="font-mono tabular-nums">
            refreshed {now.toLocaleTimeString("ko-KR", { hour12: false })}
          </span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes rowIn {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulseDot {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.5);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(185, 28, 28, 0);
          }
        }
        .animate-row-in {
          animation: rowIn 280ms ease-out both;
        }
        .animate-pulse-dot {
          animation: pulseDot 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function Kpi({
  label,
  sublabel,
  value,
  hint,
  severe,
  tone,
}: {
  label: string;
  sublabel: string;
  value: number;
  hint: string;
  severe?: boolean;
  tone?: "positive";
}) {
  const alert = severe && value > 0;
  const accent = alert
    ? "text-[#b91c1c]"
    : tone === "positive"
    ? "text-emerald-700"
    : "text-slate-900";
  return (
    <div className="bg-white px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[0.15em] text-slate-500">
            {label}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{sublabel}</div>
        </div>
        {alert && (
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#b91c1c] border border-[#b91c1c] px-1.5 py-0.5">
            ACTION
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`text-[32px] leading-none font-bold tabular-nums ${accent}`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {value.toLocaleString()}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">{hint}</span>
      </div>
    </div>
  );
}

function Card({
  className = "",
  title,
  subtitle,
  children,
}: {
  className?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`border border-slate-200 bg-white ${className}`}>
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
          {title}
        </span>
        {subtitle && (
          <span className="text-[10px] text-slate-400">{subtitle}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="text-[11px] text-slate-400 py-6 text-center">{text}</div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="flex border border-slate-300">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 text-[10px] uppercase tracking-wider border-r border-slate-300 last:border-r-0 ${
            value === o.v
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Funnel({ pipe }: { pipe: FunnelPipeline }) {
  const total = pipe.stages.reduce((s, x) => s + x.count, 0) || 1;
  const max = Math.max(...pipe.stages.map((s) => s.count), 1);
  const href = pipe.kind === "claim" ? "/ins/claims" : "/ins/contracts";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold tracking-wider uppercase">
            {pipe.kind === "claim" ? "Claim" : "Contract"}
          </span>
          <span className="text-[10px] text-slate-400">
            {pipe.kind === "claim" ? "보험금" : "프리미엄"} 파이프라인
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono tabular-nums">
          {total} active
        </span>
      </div>
      <div className="flex items-stretch border border-slate-300">
        {pipe.stages.map((s) => {
          const pct = (s.count / max) * 100;
          const isTerminal = s.key === "completed";
          return (
            <Link
              key={s.key}
              href={`${href}?stage=${s.key}`}
              className="group relative flex-1 border-r last:border-r-0 border-slate-300 hover:bg-slate-50"
            >
              <div className="px-2 pt-2 pb-1">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">
                  {s.label}
                </div>
                <div
                  className={`text-[16px] font-bold tabular-nums mt-0.5 ${
                    isTerminal ? "text-slate-400" : "text-slate-900"
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {s.count}
                </div>
              </div>
              <div className="h-[3px] bg-slate-100">
                <div
                  className={`h-full transition-all duration-700 ${
                    isTerminal ? "bg-slate-300" : "bg-slate-900"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
