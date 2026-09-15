"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";

interface CoverNoteGroup {
  cover_note_no: string;
  assured: string | null;
  line: string | null;
  cedant: string | null;
  period_from: string | null;
  period_to: string | null;
  contract_count: number;
  reinsurer_count: number;
  total_premium: number;
  total_commission: number;
  policy_id: number | null;
  claim_count: number | null;
  doc_count: number | null;
}

interface GroupList {
  items: CoverNoteGroup[];
  total: number;
  page: number;
  page_size: number;
}

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export default function ContractsByCoverNotePage() {
  const router = useRouter();
  const [data, setData] = useState<GroupList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "30" });
    if (search) params.set("search", search);
    fetchApi<GroupList>(`/api/contracts/by-cover-note?${params}`)
      .then(setData).finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / 30) : 0;

  if (loading && !data) return <div className="text-center py-20 text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-black">Contracts by Cover Note</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Grouped by cover note number — click to view policy detail</p>
      </div>

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
        <span className="ml-auto text-[12px] font-semibold text-gray-400">{data?.total || 0} cover notes</span>
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
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">RI</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Premium</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Claims</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Docs</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((g) => (
              <tr key={g.cover_note_no}
                onClick={() => g.policy_id ? router.push(`/ins/policies/${g.policy_id}`) : null}
                className={`border-b border-gray-100 last:border-0 transition-colors group ${g.policy_id ? "hover:bg-blue-50 cursor-pointer" : "hover:bg-gray-50"}`}>
                <td className="px-4 py-2.5 font-bold text-blue-600 group-hover:text-blue-800">{g.cover_note_no}</td>
                <td className="px-3 py-2.5 font-bold text-black">{g.assured || "-"}</td>
                <td className="px-3 py-2.5 font-medium">{g.line || "-"}</td>
                <td className="px-3 py-2.5 text-gray-500">{g.cedant || "-"}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-500">{g.period_from || "?"} ~ {g.period_to || "?"}</td>
                <td className="px-3 py-2.5 text-right text-gray-500">{g.reinsurer_count}</td>
                <td className="px-3 py-2.5 text-right font-bold">{fmt(g.total_premium)}</td>
                <td className="px-3 py-2.5 text-right">
                  {(g.claim_count || 0) > 0
                    ? <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{g.claim_count}</span>
                    : <span className="text-gray-300">0</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {(g.doc_count || 0) > 0
                    ? <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">{g.doc_count}</span>
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
    </div>
  );
}
