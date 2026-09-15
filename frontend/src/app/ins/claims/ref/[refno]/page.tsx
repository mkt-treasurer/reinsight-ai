"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchApi, Claim, ListResponse } from "@/lib/api";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import RecordForm from "@/components/RecordForm";

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

const editFields = [
  { key: "reinsurer", label: "Reinsurer" },
  { key: "krw_amount", label: "KRW Amount", type: "number" as const },
  { key: "soc_amount", label: "SOC Amount", type: "number" as const },
  { key: "status", label: "Status" },
  { key: "remarks", label: "Remarks" },
];

export default function RefNoDetailPage({ params }: { params: Promise<{ refno: string }> }) {
  const { refno } = use(params);
  const refNo = decodeURIComponent(refno);
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Claim | null>(null);

  const load = () => {
    fetchApi<ListResponse<Claim>>(`/api/claims?ref_no=${encodeURIComponent(refNo)}&page_size=200`)
      .then((d) => { setClaims(d.items); setLoading(false); });
  };

  useEffect(() => { load(); }, [refNo]);

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editModal) return;
    await fetchApi(`/api/claims/${editModal.id}`, { method: "PUT", body: JSON.stringify(data) });
    setEditModal(null);
    load();
  };

  if (loading) return <div className="animate-pulse"><div className="h-5 w-48 bg-slate-200 rounded mb-4" /><div className="h-48 bg-slate-100 rounded" /></div>;

  const totalKrw = claims.reduce((s, c) => s + (c.krw_amount || 0), 0);
  const totalSoc = claims.reduce((s, c) => s + (c.soc_amount || 0), 0);
  const openCount = claims.filter((c) => c.status === "Open").length;
  const accountName = claims[0]?.account_name || "Unknown";
  const reinsurers = [...new Set(claims.map((c) => c.reinsurer).filter(Boolean))];

  return (
    <div>
      <div className="mb-5">
        <button onClick={() => router.back()} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 mb-2 block">&lt; Back</button>
        <h1 className="text-lg font-extrabold text-slate-900">{refNo}</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">
          <a href={`/ins/claims/by-account/${encodeURIComponent(accountName)}`} className="text-blue-500 hover:text-blue-700">{accountName}</a>
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatCard title="Claims" value={claims.length} />
        <StatCard title="Open" value={openCount} accent={openCount > 0 ? "text-amber-600" : undefined} />
        <StatCard title="Total KRW" value={fmt(totalKrw)} accent="text-blue-600" />
        <StatCard title="Total SOC" value={fmt(totalSoc)} accent="text-violet-600" />
        <StatCard title="Reinsurers" value={reinsurers.length} />
      </div>

      <div className="flex gap-2 mb-4">
        {reinsurers.map((r) => (
          <a key={r} href={`/ins/claims/reinsurer/${encodeURIComponent(r)}`}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700">{r}</a>
        ))}
      </div>

      <div className="rounded border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Reinsurer</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Line</th>
              <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Share</th>
              <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">KRW</th>
              <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">SOC</th>
              <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">DOL</th>
              <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 w-14"></th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => {
              const socOk = c.soc_amount != null && c.krw_amount != null && Math.abs((c.krw_amount || 0) - (c.soc_amount || 0)) <= 100;
              return (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
                  <td className="px-4 py-2">
                    <a href={`/ins/claims/reinsurer/${encodeURIComponent(c.reinsurer || "")}`} className="font-bold text-blue-600 hover:text-blue-800">{c.reinsurer || "-"}</a>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{c.line || "-"}</td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {(c as Record<string, unknown>).share != null ? `${(((c as Record<string, unknown>).share as number) * 100).toFixed(1)}%` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(c.krw_amount)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${socOk ? "text-emerald-600" : c.soc_amount != null ? "text-red-600" : "text-slate-300"}`}>
                    {c.soc_amount != null ? fmt(c.soc_amount) : "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      c.status === "Open" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      c.status === "Closed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      "bg-slate-50 text-slate-500"
                    }`}>{c.status || "-"}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-[11px]">{c.dol || "-"}</td>
                  <td className="px-3 py-2 text-center opacity-0 group-hover:opacity-100">
                    <button onClick={() => setEditModal(c)} className="text-[10px] font-bold text-blue-600">Edit</button>
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={3} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Total</td>
              <td className="px-3 py-2 text-right text-[12px] font-extrabold">{fmt(totalKrw)}</td>
              <td className="px-3 py-2 text-right text-[12px] font-bold text-slate-500">{fmt(totalSoc)}</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Claim">
        <RecordForm fields={editFields} initial={editModal as unknown as Record<string, unknown> | undefined}
          onSubmit={handleUpdate} submitLabel="Update" />
      </Modal>
    </div>
  );
}
