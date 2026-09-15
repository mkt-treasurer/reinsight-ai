"use client";

import { useEffect, useState } from "react";
import { fetchApi, ReconciliationResult } from "@/lib/api";
import StatCard from "@/components/StatCard";

function fmt(val: number | null): string {
  if (val === null) return "-";
  if (Math.abs(val) >= 1e8) return `${(val / 1e8).toFixed(1)}억`;
  if (Math.abs(val) >= 1e4) return `${(val / 1e4).toFixed(0)}만`;
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

type Tab = "soc" | "cover_note" | "duplicates";

export default function ReconciliationPage() {
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("soc");

  useEffect(() => {
    fetchApi<ReconciliationResult>("/api/reconciliation/results")
      .then(setResult).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400 text-sm">Analyzing...</div>;
  if (!result) return <div className="text-center py-20 text-red-500 text-sm">Failed to load</div>;

  const { soc_summary, soc_mismatches, cover_note_summary, unbooked_cover_notes, duplicate_summary, duplicate_groups } = result;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "soc", label: "SOC Reconciliation", count: soc_summary.mismatch },
    { key: "cover_note", label: "Cover Note Integrity", count: cover_note_summary.unbooked },
    { key: "duplicates", label: "Duplicate Detection", count: duplicate_summary.duplicate_refs },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-black">Reconciliation</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">SOC amount check, cover note booking, and duplicate detection</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-6 gap-3 mb-5">
        <StatCard title="SOC Matched" value={soc_summary.exact_match.toLocaleString()} accent="text-emerald-600" />
        <StatCard title="SOC Mismatch" value={soc_summary.mismatch.toLocaleString()} accent="text-red-600" />
        <StatCard title="SOC Missing" value={soc_summary.soc_missing.toLocaleString()} accent="text-amber-600" />
        <StatCard title="CN Matched" value={cover_note_summary.matched.toLocaleString()} accent="text-emerald-600" />
        <StatCard title="CN Unbooked" value={cover_note_summary.unbooked.toLocaleString()} accent="text-red-600" />
        <StatCard title="Dup Ref No." value={duplicate_summary.duplicate_refs.toLocaleString()} accent="text-violet-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-bold transition-colors ${
              tab === t.key ? "bg-blue-600 text-white" : "text-black border border-gray-200 hover:bg-gray-100"
            }`}>
            {t.label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
              tab === t.key ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* SOC Tab */}
      {tab === "soc" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Account</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Reinsurer</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ref No.</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">KRW Amount</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">SOC Amount</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Diff</th>
              </tr>
            </thead>
            <tbody>
              {soc_mismatches.map((m, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-black">{m.account_name || "-"}</td>
                  <td className="px-4 py-2.5 font-medium text-black">{m.reinsurer || "-"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-[12px]">{m.ref_no || "-"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmt(m.krw_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmt(m.soc_amount)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${(m.difference ?? 0) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmt(m.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cover Note Tab */}
      {tab === "cover_note" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Cover Note No.</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Assured</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Line</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Issue Date</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {unbooked_cover_notes.map((cn, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-bold text-black">{cn.cover_note_number || "-"}</td>
                  <td className="px-4 py-2.5 font-medium text-black">{cn.assured || "-"}</td>
                  <td className="px-4 py-2.5 font-medium text-black">{cn.line || "-"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-[12px]">{cn.issuing_date || "-"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                      NOT BOOKED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Duplicates Tab */}
      {tab === "duplicates" && (
        <div className="space-y-2">
          {duplicate_groups.map((g, idx) => {
            const suspicious = g.claims.some((c) => c.is_suspicious);
            return (
              <div key={idx} className={`rounded-lg border bg-white overflow-hidden ${suspicious ? "border-red-200" : "border-gray-200"}`}>
                <div className={`px-4 py-2.5 flex items-center justify-between ${suspicious ? "bg-red-50" : "bg-gray-50"}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold text-black">{g.ref_no}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      suspicious
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {g.count}x {suspicious ? "SUSPICIOUS" : "DUPLICATE"}
                    </span>
                  </div>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-1.5 text-[10px] font-bold uppercase text-gray-400">Account</th>
                      <th className="text-left px-4 py-1.5 text-[10px] font-bold uppercase text-gray-400">Reinsurer</th>
                      <th className="text-right px-4 py-1.5 text-[10px] font-bold uppercase text-gray-400">KRW Amount</th>
                      <th className="text-left px-4 py-1.5 text-[10px] font-bold uppercase text-gray-400">Booking</th>
                      <th className="text-left px-4 py-1.5 text-[10px] font-bold uppercase text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.claims.map((cl, cidx) => (
                      <tr key={cidx} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-1.5 font-medium text-black">{String(cl.account_name ?? "-")}</td>
                        <td className="px-4 py-1.5 font-medium text-black">{String(cl.reinsurer ?? "-")}</td>
                        <td className="px-4 py-1.5 text-right font-medium">{fmt(cl.krw_amount as number)}</td>
                        <td className="px-4 py-1.5 text-gray-500">{String(cl.booking_month ?? "-")}</td>
                        <td className="px-4 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            cl.status === "Open" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                          }`}>{String(cl.status ?? "-")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
