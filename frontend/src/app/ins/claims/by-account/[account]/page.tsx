"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { fetchApi, Claim, ListResponse } from "@/lib/api";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import RecordForm from "@/components/RecordForm";

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function socStatus(krw: number | null, soc: number | null, tol: number): "match" | "mismatch" {
  const k = krw || 0;
  const s = soc || 0;
  return Math.abs(k - s) <= tol ? "match" : "mismatch";
}

function groupSocStatus(claims: Claim[], tol: number): { status: "match" | "mismatch"; krw: number; soc: number; diff: number } {
  const krw = claims.reduce((s, c) => s + (c.krw_amount || 0), 0);
  const soc = claims.reduce((s, c) => s + (c.soc_amount || 0), 0);
  const diff = krw - soc;
  return { status: Math.abs(diff) <= tol ? "match" : "mismatch", krw, soc, diff };
}

interface RefGroup {
  ref_no: string;
  claims: Claim[];
  totalKrw: number;
  openCount: number;
}

const claimFormFields = [
  { key: "booking_month", label: "Booking Month" },
  { key: "reinsurer", label: "Reinsurer" },
  { key: "line", label: "Line" },
  { key: "currency", label: "Currency" },
  { key: "total_amount", label: "Total Amount", type: "number" as const },
  { key: "share", label: "Share", type: "number" as const },
  { key: "krw_amount", label: "KRW Amount", type: "number" as const },
  { key: "soc_amount", label: "SOC Amount", type: "number" as const },
  { key: "status", label: "Status (Open/Closed)" },
  { key: "dol", label: "Date of Loss", type: "date" as const },
  { key: "ref_no", label: "Ref No." },
  { key: "cedant", label: "Cedant" },
  { key: "account_mgr", label: "Manager" },
  { key: "remarks", label: "Remarks" },
];

export default function AccountDetailPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = use(params);
  const accountName = decodeURIComponent(account);
  const router = useRouter();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ type: "add" | "edit"; record?: Claim } | null>(null);
  const [tolerance, setTolerance] = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchApi<ListResponse<Claim>>(`/api/claims?search=${encodeURIComponent(accountName)}&page_size=500`);
    setClaims(res.items);
    setLoading(false);
  }, [accountName]);

  useEffect(() => { load(); }, [load]);

  const openClaims = claims.filter((c) => c.status === "Open");
  const closedClaims = claims.filter((c) => c.status === "Closed");
  const totalKrw = claims.reduce((s, c) => s + (c.krw_amount || 0), 0);

  const totalSoc = claims.reduce((s, c) => s + (c.soc_amount || 0), 0);
  const totalDiff = totalKrw - totalSoc;
  const totalMatch = Math.abs(totalDiff) <= tolerance;

  const mismatchClaims = claims.filter((c) => socStatus(c.krw_amount, c.soc_amount, tolerance) === "mismatch");
  const mismatchTotal = mismatchClaims.reduce((s, c) => s + Math.abs((c.krw_amount || 0) - (c.soc_amount || 0)), 0);
  const matchedCount = claims.filter((c) => socStatus(c.krw_amount, c.soc_amount, tolerance) === "match").length;

  const reinsurers = [...new Set(claims.map((c) => c.reinsurer).filter(Boolean))] as string[];
  const lines = [...new Set(claims.map((c) => c.line).filter(Boolean))] as string[];

  // Group by Ref No
  const filtered = claims.filter((c) => {
    if (filter === "open") return c.status === "Open";
    if (filter === "closed") return c.status === "Closed";
    return true;
  });

  const groupMap = new Map<string, Claim[]>();
  for (const c of filtered) {
    const key = c.ref_no || `_no_ref_${c.id}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(c);
  }

  const groups: RefGroup[] = Array.from(groupMap.entries()).map(([ref_no, grpClaims]) => ({
    ref_no,
    claims: grpClaims,
    totalKrw: grpClaims.reduce((s, c) => s + (c.krw_amount || 0), 0),
    openCount: grpClaims.filter((c) => c.status === "Open").length,
  }));

  groups.sort((a, b) => {
    // DIFF groups first
    const aGrp = groupSocStatus(a.claims, tolerance);
    const bGrp = groupSocStatus(b.claims, tolerance);
    if (aGrp.status === "mismatch" && bGrp.status !== "mismatch") return -1;
    if (aGrp.status !== "mismatch" && bGrp.status === "mismatch") return 1;
    // Then open
    if (a.openCount > 0 && b.openCount === 0) return -1;
    if (a.openCount === 0 && b.openCount > 0) return 1;
    return Math.abs(b.totalKrw) - Math.abs(a.totalKrw);
  });

  const toggleExpand = (ref: string) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(ref)) next.delete(ref); else next.add(ref); return next; });
  };
  const expandAll = () => setExpanded(new Set(groups.map((g) => g.ref_no)));
  const collapseAll = () => setExpanded(new Set());

  const handleCreate = async (data: Record<string, unknown>) => {
    await fetchApi("/api/claims", { method: "POST", body: JSON.stringify({ ...data, account_name: accountName }) });
    setModal(null); load();
  };
  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!modal?.record) return;
    await fetchApi(`/api/claims/${modal.record.id}`, { method: "PUT", body: JSON.stringify(data) });
    setModal(null); load();
  };
  const handleDelete = async (claim: Claim) => {
    if (!confirm(`Delete claim ${claim.ref_no || claim.id}?`)) return;
    await fetchApi(`/api/claims/${claim.id}`, { method: "DELETE" }); load();
  };

  if (loading) return <div className="text-center py-20 text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="mb-5">
        <button onClick={() => router.push("/ins/claims/by-account")}
          className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 mb-2 block">&lt; Back to accounts</button>
        <h1 className="text-xl font-extrabold text-black">{accountName}</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">{groups.length} ref groups, {claims.length} total claims</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-3">
        <StatCard title="Total Claims" value={claims.length} />
        <StatCard title="Open" value={openClaims.length} accent="text-amber-600" />
        <StatCard title="Closed" value={closedClaims.length} accent="text-emerald-600" />
        <StatCard title="Total KRW" value={fmt(totalKrw)} accent="text-blue-600" />
        <StatCard title="Mismatch Total" value={fmt(mismatchTotal)} accent={mismatchTotal > 0 ? "text-red-600" : "text-emerald-600"} />
      </div>

      {/* KRW vs SOC: only comparable claims */}
      <div className={`rounded-lg border p-3 mb-5 flex items-center justify-between ${totalMatch ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="font-bold text-black">SOC Check</span>
          <span className="font-medium">{fmt(totalKrw)}</span>
          <span className="text-gray-400">vs</span>
          <span className="font-medium">{fmt(totalSoc)}</span>
          {totalMatch ? (
            <span className="font-extrabold text-emerald-700">MATCH</span>
          ) : (
            <span className="font-extrabold text-red-700">DIFF {fmt(totalDiff)}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-emerald-700 font-bold">{matchedCount} ok</span>
          {mismatchClaims.length > 0 && <span className="text-red-600 font-bold">{mismatchClaims.length} diff</span>}
        </div>
      </div>

      {/* Tolerance + Badges */}
      <div className="flex items-center gap-6 mb-5">
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
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mr-2">Reinsurers:</span>
          {reinsurers.map((r) => (
            <span key={r} className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-black border border-gray-200 mr-1 mb-1">{r}</span>
          ))}
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mr-2">Lines:</span>
          {lines.map((l) => (
            <span key={l} className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 mr-1 mb-1">{l}</span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        {(["all", "open", "closed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors ${filter === f ? "bg-blue-600 text-white" : "text-black border border-gray-200 hover:bg-gray-100"}`}>
            {f === "all" ? `All (${claims.length})` : f === "open" ? `Open (${openClaims.length})` : `Closed (${closedClaims.length})`}
          </button>
        ))}
        <button onClick={expandAll} className="text-[11px] font-semibold text-gray-400 hover:text-black ml-2">Expand all</button>
        <button onClick={collapseAll} className="text-[11px] font-semibold text-gray-400 hover:text-black">Collapse all</button>
        <button onClick={() => setModal({ type: "add" })}
          className="ml-auto px-3 py-1.5 border border-blue-600 text-blue-600 rounded-md text-[12px] font-bold hover:bg-blue-50">+ New Claim</button>
      </div>

      {/* Ref No Groups */}
      <div className="space-y-1">
        {groups.map((g) => {
          const isExp = expanded.has(g.ref_no);
          const hasNoRef = g.ref_no.startsWith("_no_ref_");
          const grp = groupSocStatus(g.claims, tolerance);

          return (
            <div key={g.ref_no} className={`rounded-lg border bg-white overflow-hidden ${grp.status === "mismatch" ? "border-red-200" : "border-gray-200"}`}>
              <div onClick={() => toggleExpand(g.ref_no)}
                className={`flex items-center px-4 py-2.5 cursor-pointer transition-colors ${isExp ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                <span className="text-[11px] text-gray-400 mr-2 w-4">{isExp ? "v" : ">"}</span>
                <span className="text-[13px] font-bold text-black flex-1">
                  {hasNoRef ? <span className="text-gray-400 italic">No Ref</span> : g.ref_no}
                </span>
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="text-gray-400">{g.claims.length}</span>
                  {g.openCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{g.openCount} open</span>
                  )}
                  <span className="font-bold text-black w-36 text-right">{fmt(g.totalKrw)}</span>
                  {/* SOC status: only show diff amount if mismatch */}
                  {grp.status === "match" ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">MATCH</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                      {fmt(grp.diff)}
                    </span>
                  )}
                </div>
              </div>

              {isExp && (
                <div className="border-t border-gray-200">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-6 py-2 text-[10px] font-bold uppercase text-gray-400">Reinsurer</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Line</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Booking</th>
                        <th className="text-right px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Share</th>
                        <th className="text-right px-3 py-2 text-[10px] font-bold uppercase text-gray-400">KRW</th>
                        <th className="text-right px-3 py-2 text-[10px] font-bold uppercase text-gray-400">SOC</th>
                        <th className="text-center px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Diff</th>
                        <th className="text-center px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Status</th>
                        <th className="text-center px-3 py-2 text-[10px] font-bold uppercase text-gray-400 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.claims.map((c) => {
                        const ss = socStatus(c.krw_amount, c.soc_amount, tolerance);
                        const diff = (c.krw_amount || 0) - (c.soc_amount || 0);
                        return (
                          <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-blue-50/30 group">
                            <td className="px-6 py-2 font-bold text-black">{c.reinsurer || "-"}</td>
                            <td className="px-3 py-2 text-black">{c.line || "-"}</td>
                            <td className="px-3 py-2 text-gray-500">{c.booking_month || "-"}</td>
                            <td className="px-3 py-2 text-right text-gray-500">
                              {(c as Record<string, unknown>).share != null ? `${((c as Record<string, unknown>).share as number * 100).toFixed(1)}%` : "-"}
                            </td>
                            <td className="px-3 py-2 text-right font-bold">{fmt(c.krw_amount)}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-500">
                              {c.soc_amount != null ? fmt(c.soc_amount) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {ss === "match" && <span className="text-[10px] font-bold text-emerald-600">OK</span>}
                              {ss === "mismatch" && <span className="text-[10px] font-bold text-red-600">{fmt(diff)}</span>}
                                                          </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                c.status === "Open" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                c.status === "Closed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-50 text-gray-500"
                              }`}>{c.status || "-"}</span>
                            </td>
                            <td className="px-3 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setModal({ type: "edit", record: c }); }}
                                className="text-[10px] font-bold text-blue-600 mr-1">Edit</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                                className="text-[10px] font-bold text-red-500">Del</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.type === "add" ? "New Claim" : "Edit Claim"}>
        <RecordForm fields={claimFormFields} initial={modal?.record as Record<string, unknown> | undefined}
          onSubmit={modal?.type === "add" ? handleCreate : handleUpdate}
          submitLabel={modal?.type === "add" ? "Create" : "Update"} />
      </Modal>
    </div>
  );
}
