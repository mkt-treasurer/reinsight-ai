"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import StatCard from "@/components/StatCard";

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

interface Diff { stmt: number; db: number; diff: number; }
interface ReinsurerDiff { reinsurer: string; db_reinsurer?: string; status: string; diffs?: Record<string, Diff>; stmt_gross?: number; }
interface FileResult { file: string; cover_note_no: string; assured: string; reinsurer_diffs: ReinsurerDiff[]; all_match: boolean; }
interface NotFound { file: string; cover_note_no: string; assured: string; stmt_reinsurers: number; stmt_total: number; }
interface AuditResult {
  total_files: number; parsed: number; matches: number; mismatches: number;
  not_found_in_db: number; parse_errors: number;
  mismatch_details: FileResult[]; not_found_details: NotFound[]; match_details: FileResult[];
}

export default function ContractAuditPage() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mismatches" | "not_found" | "matches">("mismatches");

  useEffect(() => {
    fetchApi<AuditResult>("/api/audit-data/premium", { method: "POST" })
      .then(setResult).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse"><div className="h-5 w-32 bg-slate-200 rounded mb-4" /><div className="grid grid-cols-4 gap-3 mb-5">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded" />)}</div></div>;

  if (!result) return <div className="text-center py-16 text-slate-400 text-[13px]">Failed to load</div>;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-slate-900">Contract Data Audit</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Compare STMT files (Actual 2026) with database contracts</p>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatCard title="STMT Files" value={result.total_files} />
        <StatCard title="Matched" value={result.matches} accent="text-emerald-600" />
        <StatCard title="Mismatches" value={result.mismatches} accent={result.mismatches > 0 ? "text-red-600" : "text-emerald-600"} />
        <StatCard title="Not in DB" value={result.not_found_in_db} accent={result.not_found_in_db > 0 ? "text-amber-600" : undefined} />
        <StatCard title="Parse Errors" value={result.parse_errors} />
      </div>

      <div className="flex gap-1 mb-4">
        {[
          { key: "mismatches" as const, label: "Mismatches", count: result.mismatches, color: "bg-red-600" },
          { key: "not_found" as const, label: "Not in DB", count: result.not_found_in_db, color: "bg-amber-600" },
          { key: "matches" as const, label: "Matched", count: result.matches, color: "bg-emerald-600" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${tab === t.key ? `${t.color} text-white` : "text-slate-500 border border-slate-200"}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === "mismatches" && (
        <div className="space-y-1.5">
          {result.mismatch_details.map((f, i) => (
            <div key={i} className="rounded border border-red-200 bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-red-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-slate-900">{f.cover_note_no}</span>
                  <span className="text-[11px] text-slate-500">{f.assured}</span>
                </div>
                <span className="text-[10px] text-slate-400">{f.file}</span>
              </div>
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-1.5 font-bold text-slate-400">Reinsurer</th>
                  <th className="text-center px-3 py-1.5 font-bold text-slate-400">Status</th>
                  <th className="text-right px-3 py-1.5 font-bold text-slate-400">STMT</th>
                  <th className="text-right px-3 py-1.5 font-bold text-slate-400">DB</th>
                  <th className="text-right px-3 py-1.5 font-bold text-slate-400">Diff</th>
                </tr></thead>
                <tbody>
                  {f.reinsurer_diffs.map((rd, j) => (
                    <tr key={j} className="border-b border-slate-50">
                      <td className="px-4 py-1.5 font-bold">{rd.reinsurer}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${rd.status === "match" ? "bg-emerald-50 text-emerald-700" : rd.status === "not_in_db" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                          {rd.status === "match" ? "OK" : rd.status === "not_in_db" ? "N/A" : "DIFF"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">{rd.diffs?.gross_premium ? fmt(rd.diffs.gross_premium.stmt) : fmt(rd.stmt_gross)}</td>
                      <td className="px-3 py-1.5 text-right">{rd.diffs?.gross_premium ? fmt(rd.diffs.gross_premium.db) : "-"}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-red-600">{rd.diffs?.gross_premium ? fmt(rd.diffs.gross_premium.diff) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {result.mismatch_details.length === 0 && <div className="text-center py-8 text-slate-400 text-[12px]">No mismatches</div>}
        </div>
      )}

      {tab === "not_found" && (
        <div className="rounded border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400">Cover Note</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400">Assured</th>
              <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400">Total</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400">File</th>
            </tr></thead>
            <tbody>
              {result.not_found_details.map((nf, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-bold">{nf.cover_note_no}</td>
                  <td className="px-3 py-2">{nf.assured}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(nf.stmt_total)}</td>
                  <td className="px-3 py-2 text-[10px] text-slate-400">{nf.file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "matches" && (
        <div className="rounded border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400">Cover Note</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400">Assured</th>
              <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400">Reinsurers</th>
              <th className="text-center px-3 py-2 text-[10px] font-bold text-slate-400">Status</th>
            </tr></thead>
            <tbody>
              {result.match_details.map((m, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-bold">{m.cover_note_no}</td>
                  <td className="px-3 py-2">{m.assured}</td>
                  <td className="px-3 py-2 text-right">{m.reinsurer_diffs.length}</td>
                  <td className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700">ALL MATCH</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
