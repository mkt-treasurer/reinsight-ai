"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";

interface AccountSummary {
  account_name: string;
  total_claims: number;
  open_claims: number;
  closed_claims: number;
  total_krw: number;
  total_soc: number;
  open_krw: number;
  reinsurer_count: number;
  line_count: number;
}

interface AccountSummaryList {
  items: AccountSummary[];
  total: number;
  page: number;
  page_size: number;
}

function fmt(val: number): string {
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export default function ClaimsByAccountPage() {
  const router = useRouter();
  const [data, setData] = useState<AccountSummaryList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("total_krw");
  const [loading, setLoading] = useState(true);
  const [tolerance, setTolerance] = useState(100);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "30", sort_by: sortBy });
    if (search) params.set("search", search);
    fetchApi<AccountSummaryList>(`/api/claims/by-account?${params}`)
      .then(setData).finally(() => setLoading(false));
  }, [page, search, sortBy]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / 30) : 0;

  if (loading && !data) return <div className="text-center py-20 text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-black">Claims by Account</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Click an account to view and manage its claims</p>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex gap-2">
          <input type="text" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            placeholder="Search account..."
            className="px-3 py-1.5 border border-gray-200 rounded-md text-[13px] w-60 focus:outline-none focus:border-blue-500" />
          <button onClick={() => { setSearch(searchInput); setPage(1); }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-[13px] font-semibold hover:bg-blue-700">
            Search
          </button>
        </div>
        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="px-2 py-1.5 border border-gray-200 rounded-md text-[12px] font-semibold bg-white">
          <option value="total_krw">Sort: Amount</option>
          <option value="total_claims">Sort: Count</option>
          <option value="open_claims">Sort: Open</option>
          <option value="account_name">Sort: Name</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Tolerance:</span>
          <select value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))}
            className="px-2 py-1 border border-gray-200 rounded-md text-[12px] font-bold bg-white">
            <option value={0}>Exact</option>
            <option value={1}>1</option>
            <option value={10}>10</option>
            <option value={100}>100</option>
            <option value={1000}>1,000</option>
            <option value={10000}>10,000</option>
          </select>
        </div>
        <span className="ml-auto text-[12px] font-semibold text-gray-400">{data?.total || 0} accounts</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {[
                { key: "account_name", label: "Account", align: "text-left px-4" },
                { key: "total_claims", label: "Claims", align: "text-right px-3" },
                { key: "open_claims", label: "Open", align: "text-right px-3" },
                { key: "total_krw", label: "Total KRW", align: "text-right px-3" },
              ].map((col) => (
                <th key={col.key}
                  onClick={() => { setSortBy(col.key); setPage(1); }}
                  className={`${col.align} py-2.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer hover:text-black ${sortBy === col.key ? "text-blue-600" : "text-gray-400"}`}>
                  {col.label} {sortBy === col.key && "v"}
                </th>
              ))}
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Total SOC</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Diff</th>
              <th className="text-center px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">SOC</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((acct) => {
              const diff = acct.total_krw - acct.total_soc;
              const matched = Math.abs(diff) <= tolerance;
              const hasSoc = acct.total_soc !== 0;

              return (
                <tr key={acct.account_name}
                  onClick={() => router.push(`/ins/claims/by-account/${encodeURIComponent(acct.account_name)}`)}
                  className="border-b border-gray-100 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors group">
                  <td className="px-4 py-3 font-bold text-black group-hover:text-blue-600 transition-colors">
                    {acct.account_name}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold">{acct.total_claims}</td>
                  <td className="px-3 py-2.5 text-right">
                    {acct.open_claims > 0
                      ? <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{acct.open_claims}</span>
                      : <span className="text-gray-300">0</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold">{fmt(acct.total_krw)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-500">
                    {hasSoc ? fmt(acct.total_soc) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold ${
                    !hasSoc ? "" : matched ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {!hasSoc ? <span className="text-gray-300">-</span> : matched ? "0" : fmt(diff)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {!hasSoc ? (
                      <span className="text-[10px] text-gray-300">-</span>
                    ) : matched ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">MATCH</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">DIFF</span>
                    )}
                  </td>
                </tr>
              );
            })}
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
    </div>
  );
}
