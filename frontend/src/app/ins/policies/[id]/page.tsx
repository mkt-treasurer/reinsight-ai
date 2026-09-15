"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import StatCard from "@/components/StatCard";

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

interface PolicyDetail {
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
  contracts: { id: number; reinsurer: string; share: number | null; ri_prem: number | null; ri_commission: number | null; rec_date: string | null; paid_date: string | null }[];
  claims: { id: number; account_name: string; reinsurer: string; ref_no: string | null; krw_amount: number | null; status: string | null; dol: string | null; link_score: number; link_method: string }[];
  documents: { id: number; doc_type: string; file_name: string; file_path: string }[];
}

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<PolicyDetail>(`/api/policies/${id}`)
      .then(setPolicy).finally(() => setLoading(false));
  }, [id]);

  if (loading || !policy) return <div className="text-center py-20 text-gray-400 text-sm">Loading...</div>;

  const totalClaimKrw = policy.claims.reduce((s, c) => s + (c.krw_amount || 0), 0);
  const totalPremium = policy.contracts.reduce((s, c) => s + (c.ri_prem || 0), 0);
  const totalCommission = policy.contracts.reduce((s, c) => s + (c.ri_commission || 0), 0);

  return (
    <div>
      <div className="mb-5">
        <button onClick={() => router.push("/ins/policies")}
          className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 mb-2 block">&lt; Back to policies</button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold text-black">{policy.assured}</h1>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{policy.cover_note_no}</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">{policy.line}</span>
        </div>
        <p className="text-[12px] text-gray-400 mt-1">
          {policy.cedant} / {policy.period_from} ~ {policy.period_to}
        </p>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-6">
        <StatCard title="Total Premium" value={fmt(totalPremium)} accent="text-blue-600" />
        <StatCard title="Total Commission" value={fmt(totalCommission)} accent="text-violet-600" />
        <StatCard title="Reinsurers" value={policy.reinsurer_count || 0} />
        <StatCard title="Contracts" value={policy.contract_count || 0} />
        <StatCard title="Claims Linked" value={policy.claims.length} accent={policy.claims.length > 0 ? "text-amber-600" : undefined} />
        <StatCard title="Claims KRW" value={fmt(totalClaimKrw)} accent="text-red-600" />
      </div>

      {/* Contracts (reinsurer splits) */}
      <div className="mb-6">
        <h2 className="text-[14px] font-extrabold text-black mb-3">Reinsurer Splits ({policy.contracts.length})</h2>
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Reinsurer</th>
                <th className="text-right px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Share</th>
                <th className="text-right px-3 py-2 text-[10px] font-bold uppercase text-gray-400">RI Premium</th>
                <th className="text-right px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Commission</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Rec Date</th>
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {policy.contracts.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 font-bold text-black">{c.reinsurer}</td>
                  <td className="px-3 py-2 text-right">{c.share != null ? `${(c.share * 100).toFixed(1)}%` : "-"}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(c.ri_prem)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmt(c.ri_commission)}</td>
                  <td className="px-3 py-2 text-gray-500">{c.rec_date || "-"}</td>
                  <td className="px-3 py-2 text-gray-500">{c.paid_date || "-"}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase">Total</td>
                <td className="px-3 py-2 text-right text-[11px] font-bold text-gray-400">
                  {policy.contracts.reduce((s, c) => s + (c.share || 0), 0) > 0
                    ? `${(policy.contracts.reduce((s, c) => s + (c.share || 0), 0) * 100).toFixed(1)}%`
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right text-[12px] font-extrabold text-black">{fmt(totalPremium)}</td>
                <td className="px-3 py-2 text-right text-[12px] font-bold text-gray-500">{fmt(totalCommission)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Linked Claims */}
      <div className="mb-6">
        <h2 className="text-[14px] font-extrabold text-black mb-3">
          Linked Claims ({policy.claims.length})
        </h2>
        {policy.claims.length === 0 ? (
          <div className="text-center py-8 border border-gray-200 rounded-lg bg-white text-[13px] text-gray-400">
            No claims linked to this policy
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-center px-3 py-2 text-[10px] font-bold uppercase text-gray-400 w-14">Score</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Account</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Reinsurer</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Ref No.</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold uppercase text-gray-400">KRW</th>
                  <th className="text-center px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Status</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">DOL</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Method</th>
                </tr>
              </thead>
              <tbody>
                {policy.claims.map((cl) => (
                  <tr key={cl.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block w-8 text-center px-1 py-0.5 rounded text-[10px] font-bold ${
                        cl.link_score >= 70 ? "bg-emerald-50 text-emerald-700" :
                        cl.link_score >= 50 ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                      }`}>{cl.link_score}</span>
                    </td>
                    <td className="px-3 py-2 font-bold text-black">{cl.account_name || "-"}</td>
                    <td className="px-3 py-2 font-medium">{cl.reinsurer || "-"}</td>
                    <td className="px-3 py-2 text-gray-500">{cl.ref_no || "-"}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(cl.krw_amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        cl.status === "Open" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>{cl.status || "-"}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{cl.dol || "-"}</td>
                    <td className="px-3 py-2">
                      <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-500">{cl.link_method}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-extrabold text-black">Documents ({policy.documents.length})</h2>
          {policy.documents.length === 0 && (
            <button onClick={async () => {
              await fetchApi("/api/policies/scan-files", { method: "POST" });
              const updated = await fetchApi<PolicyDetail>(`/api/policies/${id}`);
              setPolicy(updated);
            }}
              className="text-[12px] font-bold text-blue-600 hover:text-blue-800">Scan Files</button>
          )}
        </div>
        {policy.documents.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg bg-white text-[13px] text-gray-400">
            No documents. Click "Scan Files" to match from Actual data folder.
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Type</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">File</th>
                  <th className="text-center px-3 py-2 text-[10px] font-bold uppercase text-gray-400 w-16">Open</th>
                </tr>
              </thead>
              <tbody>
                {policy.documents.map((d) => {
                  const typeColors: Record<string, string> = {
                    closing: "bg-blue-50 text-blue-700 border-blue-200",
                    stmt: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    cd_note: "bg-violet-50 text-violet-700 border-violet-200",
                    slip: "bg-amber-50 text-amber-700 border-amber-200",
                    signed: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    endorsement: "bg-orange-50 text-orange-700 border-orange-200",
                    email: "bg-gray-50 text-gray-600 border-gray-200",
                  };
                  const color = typeColors[d.doc_type] || "bg-gray-50 text-gray-600 border-gray-200";
                  const fileUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601"}/files/${encodeURI(d.file_path)}`;
                  return (
                    <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${color}`}>{d.doc_type}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-black">{d.file_name}</td>
                      <td className="px-3 py-2 text-center">
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800">View</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
