"use client";

/**
 * Admin → Slip Testbench → Runs
 *
 * Lists every persisted testbench run (newest first), draws a trend
 * line of weighted accuracy per doc-type, and exposes a button to
 * trigger a new run against the on-disk dataset.
 *
 * The "Run New" submit blocks until the backend finishes — runs are
 * scoped to a small admin dataset, not a production workload.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

interface RunSummary {
  id: string;
  label: string | null;
  dataset_path: string;
  status: "running" | "done" | "error";
  doc_types: string[] | null;
  summary: {
    pairs: number;
    compared_pairs: number;
    weighted_accuracy: number | null;
    severity_counts: { match: number; minor: number; major: number; missing: number };
    by_doc_type: Record<
      string,
      {
        pairs: number;
        weighted_accuracy: number | null;
        severity: { match: number; minor: number; major: number; missing: number };
      }
    >;
    by_cause?: Record<string, number>;
  } | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  pla: "PLA",
  soc: "SOC",
  pla_bordereau: "PLA Bord.",
  soc_bordereau: "SOC Bord.",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  pla: "#1e40af",
  soc: "#0f172a",
  pla_bordereau: "#b45309",
  soc_bordereau: "#b91c1c",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

export default function RunsListPage() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [label, setLabel] = useState("");
  const [docTypes, setDocTypes] = useState<Record<string, boolean>>({
    pla: true,
    soc: true,
    pla_bordereau: true,
    soc_bordereau: true,
  });
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const r = await fetch(`${API_URL}/api/admin/slip-testbench/runs`);
    if (!r.ok) {
      setError(`HTTP ${r.status}`);
      return;
    }
    setRuns((await r.json()) as RunSummary[]);
  };

  useEffect(() => {
    reload();
  }, []);

  const trendSeries = useMemo(() => {
    if (!runs) return [];
    const done = runs
      .filter((r) => r.status === "done")
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return done.map((r) => {
      const point: Record<string, string | number> = {
        t: fmtTime(r.created_at),
      };
      if (r.summary?.by_doc_type) {
        for (const [dt, slot] of Object.entries(r.summary.by_doc_type)) {
          if (slot.weighted_accuracy != null) {
            point[dt] = Number((slot.weighted_accuracy * 100).toFixed(2));
          }
        }
      }
      return point;
    });
  }, [runs]);

  const activeDocTypes = useMemo(() => {
    const set = new Set<string>();
    for (const p of trendSeries) {
      for (const k of Object.keys(p)) if (k !== "t") set.add(k);
    }
    return Array.from(set).sort();
  }, [trendSeries]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const selected = Object.entries(docTypes)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const r = await fetch(`${API_URL}/api/admin/slip-testbench/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || null,
          doc_types: selected.length === 4 ? null : selected,
        }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status} ${t}`);
      }
      await reload();
      setLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      <div className="border-b border-slate-900 px-6 py-4 bg-slate-900 text-white">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-300">
          Admin · Slip Testbench · Runs
        </div>
        <div className="text-[18px] font-bold mt-1">저장된 회귀 실행</div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          testbench-dataset 폴더 기반 추출 → 비교 → VLM 분석 결과 영속화.
          시간별 일치율 추세 확인용.
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Trigger panel */}
        <div className="border border-slate-200 bg-white">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
              New Run
            </span>
            <span className="text-[10px] text-slate-400">신규 실행 트리거</span>
          </div>
          <div className="p-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
                Label
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="예: PR#2 회귀"
                className="border border-slate-300 px-2 py-1 text-[11px] w-56"
              />
            </label>
            <div className="flex gap-2 items-center">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
                Doc Types
              </span>
              {Object.keys(DOC_TYPE_LABEL).map((dt) => (
                <label
                  key={dt}
                  className="flex items-center gap-1 text-[11px] text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={docTypes[dt]}
                    onChange={(e) =>
                      setDocTypes((s) => ({ ...s, [dt]: e.target.checked }))
                    }
                    className="accent-slate-900"
                  />
                  <span>{DOC_TYPE_LABEL[dt]}</span>
                </label>
              ))}
            </div>
            <button
              disabled={submitting}
              onClick={submit}
              className="ml-auto px-4 py-1.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Running…" : "Run"}
            </button>
          </div>
          {error && (
            <div className="px-4 py-2 border-t border-rose-200 bg-rose-50 text-[11px] text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Trend chart */}
        <div className="border border-slate-200 bg-white">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
              Weighted Accuracy Trend
            </span>
            <span className="text-[10px] text-slate-400">문서 타입별 시간 추세</span>
          </div>
          <div className="p-4">
            {trendSeries.length === 0 ? (
              <div className="text-[11px] text-slate-400 text-center py-12">
                완료된 실행이 아직 없습니다.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendSeries}>
                  <CartesianGrid
                    stroke="#f1f5f9"
                    strokeDasharray="2 2"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
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
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {activeDocTypes.map((dt) => (
                    <Line
                      key={dt}
                      type="monotone"
                      dataKey={dt}
                      name={DOC_TYPE_LABEL[dt] ?? dt}
                      stroke={DOC_TYPE_COLORS[dt] ?? "#0f172a"}
                      strokeWidth={1.5}
                      dot={{ r: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Runs table */}
        <div className="border border-slate-200 bg-white">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
              All Runs
            </span>
            <span className="text-[10px] text-slate-400">{runs?.length ?? 0} 건</span>
          </div>
          <table className="w-full text-[11px]">
            <thead className="bg-white border-b border-slate-200">
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-3 py-2 font-bold">When</th>
                <th className="text-left px-3 py-2 font-bold">Label</th>
                <th className="text-left px-3 py-2 font-bold">Doc Types</th>
                <th className="text-right px-3 py-2 font-bold">Pairs</th>
                <th className="text-right px-3 py-2 font-bold">Accuracy</th>
                <th className="text-left px-3 py-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs && runs.length > 0 ? (
                runs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">
                      <Link
                        href={`/ins/admin/slip-testbench/runs/${r.id}`}
                        className="text-[#1e40af] hover:underline"
                      >
                        {fmtTime(r.created_at)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.label || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 font-mono">
                      {(r.doc_types ?? []).map((d) => DOC_TYPE_LABEL[d] ?? d).join(", ")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.summary?.pairs ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold">
                      {fmtPct(r.summary?.weighted_accuracy ?? null)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-slate-400 text-[11px]"
                  >
                    {runs === null ? "Loading…" : "저장된 실행이 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "bg-amber-100 text-amber-800",
    done: "bg-emerald-100 text-emerald-800",
    error: "bg-rose-100 text-rose-800",
  };
  return (
    <span
      className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${
        map[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}
