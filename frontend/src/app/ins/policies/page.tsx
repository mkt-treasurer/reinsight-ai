"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import StatCard from "@/components/StatCard";

interface Policy {
  id: number;
  cover_note_no: string | null;
  assured: string | null;
  line: string | null;
  cedant: string | null;
  period_from: string | null;
  period_to: string | null;
  total_premium: number | null;
  reinsurer_count: number | null;
  contract_count: number | null;
  claim_count: number | null;
}

interface PolicyList {
  items: Policy[];
  total: number;
  page: number;
  page_size: number;
}

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export default function PoliciesPage() {
  const router = useRouter();
  const [data, setData] = useState<PolicyList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [hasClaims, setHasClaims] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ total_files: number; matched_files: number; unmatched_files: number; unmatched_deals: string[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "30" });
    if (search) params.set("search", search);
    if (hasClaims === "yes") params.set("has_claims", "true");
    if (hasClaims === "no") params.set("has_claims", "false");
    fetchApi<PolicyList>(`/api/policies?${params}`)
      .then(setData).finally(() => setLoading(false));
  }, [page, search, hasClaims]);

  useEffect(() => { load(); }, [load]);

  const handleBuild = async () => {
    setBuilding(true);
    await fetchApi("/api/policies/build", { method: "POST" });
    setBuilding(false);
    load();
  };

  const handleScan = async () => {
    setScanning(true);
    const res = await fetchApi<{ total_files: number; matched_files: number; unmatched_files: number; unmatched_deals: string[] }>("/api/policies/scan-files", { method: "POST" });
    setScanResult(res);
    setScanning(false);
    load();
  };

  const totalPages = data ? Math.ceil(data.total / 30) : 0;
  const totalPolicies = data?.total || 0;
  const withClaims = data?.items.filter((p) => (p.claim_count || 0) > 0).length || 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-black">Policies</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Insurance policies grouped by cover note, linking contracts and claims</p>
      </div>

      {totalPolicies === 0 && !loading ? (
        <div className="text-center py-16 border border-gray-200 rounded-lg bg-white">
          <p className="text-[14px] font-bold text-black mb-2">No policies yet</p>
          <p className="text-[12px] text-gray-400 mb-4">Build policies from contracts and auto-link claims</p>
          <button onClick={handleBuild} disabled={building}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50">
            {building ? "Building..." : "Build Policies"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatCard title="Total Policies" value={totalPolicies} />
            <StatCard title="With Claims (this page)" value={withClaims} accent="text-amber-600" />
            <StatCard title="Total Premium (this page)" value={fmt(data?.items.reduce((s, p) => s + (p.total_premium || 0), 0) || 0)} accent="text-blue-600" />
          </div>

          {/* Scan result banner */}
          {scanResult && (
            <div className={`rounded-lg border p-3 mb-4 ${scanResult.unmatched_files > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <div className="flex items-center gap-4 text-[13px]">
                <span className="font-bold text-black">File Scan Result</span>
                <span className="font-bold text-emerald-700">{scanResult.matched_files} matched</span>
                <span className="text-gray-400">/</span>
                <span className="font-medium">{scanResult.total_files} total</span>
                {scanResult.unmatched_files > 0 && (
                  <span className="font-bold text-amber-700">{scanResult.unmatched_files} unmatched</span>
                )}
                <span className="text-[12px] text-gray-400">
                  ({(scanResult.matched_files / scanResult.total_files * 100).toFixed(1)}%)
                </span>
              </div>
              {scanResult.unmatched_deals.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-[12px]">
                  <span className="text-gray-400">Unmatched deals:</span>
                  {scanResult.unmatched_deals.map((d) => (
                    <span key={d} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">{d}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {scanning && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mb-4 text-[13px] text-blue-700 font-medium">
              Scanning files with AI matching... This may take a moment.
            </div>
          )}

          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-2">
              <input type="text" value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
                placeholder="Search assured or cover note..."
                className="px-3 py-1.5 border border-gray-200 rounded-md text-[13px] w-64 focus:outline-none focus:border-blue-500" />
              <button onClick={() => { setSearch(searchInput); setPage(1); }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-[13px] font-semibold hover:bg-blue-700">Search</button>
            </div>
            <select value={hasClaims} onChange={(e) => { setHasClaims(e.target.value); setPage(1); }}
              className="px-2 py-1.5 border border-gray-200 rounded-md text-[12px] font-semibold bg-white">
              <option value="all">All</option>
              <option value="yes">With Claims</option>
              <option value="no">No Claims</option>
            </select>
            <button onClick={handleBuild} disabled={building}
              className="text-[12px] font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50">
              {building ? "Rebuilding..." : "Rebuild"}
            </button>
            <button onClick={handleScan} disabled={scanning}
              className="text-[12px] font-bold text-violet-600 hover:text-violet-800 disabled:opacity-50">
              {scanning ? "Scanning..." : "Scan Files"}
            </button>
            <span className="ml-auto text-[12px] font-semibold text-gray-400">{totalPolicies} policies</span>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Cover Note</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Assured</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Line</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Cedant</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Period</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Premium</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">RI</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Claims</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((p) => (
                  <tr key={p.id} onClick={() => router.push(`/ins/policies/${p.id}`)}
                    className="border-b border-gray-100 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors group">
                    <td className="px-4 py-2.5 font-bold text-blue-600 group-hover:text-blue-800">{p.cover_note_no || "-"}</td>
                    <td className="px-3 py-2.5 font-bold text-black">{p.assured || "-"}</td>
                    <td className="px-3 py-2.5 font-medium">{p.line || "-"}</td>
                    <td className="px-3 py-2.5 text-gray-500">{p.cedant || "-"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-500">
                      {p.period_from || "?"} ~ {p.period_to || "?"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold">{fmt(p.total_premium)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{p.reinsurer_count || 0}</td>
                    <td className="px-3 py-2.5 text-right">
                      {(p.claim_count || 0) > 0
                        ? <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{p.claim_count}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1}
                className="px-3 py-1 rounded-md border border-gray-200 text-[12px] font-semibold disabled:opacity-30 hover:bg-gray-100">Prev</button>
              <span className="text-[12px] font-bold text-black">{page} / {totalPages}</span>
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1 rounded-md border border-gray-200 text-[12px] font-semibold disabled:opacity-30 hover:bg-gray-100">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
