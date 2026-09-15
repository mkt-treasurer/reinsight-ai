"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import StatCard from "@/components/StatCard";
import ReactMarkdown from "react-markdown";

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

interface Draft { id: number; reinsurer: string; share: number; ri_premium: number; commission: number; net_premium: number; doc_type: string; subject: string; body: string; status: string; }
interface CaseDetail {
  id: number; assured: string; cedant: string | null; line: string | null; cover_note_no: string | null;
  currency: string | null; gross_premium: number | null; ai_summary: string | null; status: string;
  policy_assured: string | null; policy_cover_note: string | null; matched_policy_id: number | null;
  drafts: Draft[];
}

export default function ContractCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [c, setCase] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const load = () => { fetchApi<CaseDetail>(`/api/contract-cases/${id}`).then((d) => { setCase(d); setLoading(false); }); };
  useEffect(() => { load(); }, [id]);

  if (loading || !c) return <div className="animate-pulse"><div className="h-5 w-40 bg-slate-200 rounded mb-4" /><div className="grid grid-cols-5 gap-3 mb-5">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-200 rounded" />)}</div></div>;

  const totalPrem = c.drafts.reduce((s, d) => s + (d.ri_premium || 0), 0);

  return (
    <div>
      <div className="mb-5">
        <button onClick={() => router.push("/ins/contracts/process")} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 mb-2 block">&lt; Back</button>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-extrabold text-slate-900">{c.assured}</h1>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{c.status}</span>
          {c.cover_note_no && <span className="text-[12px] text-slate-400">{c.cover_note_no}</span>}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatCard title="Gross Premium" value={`${c.currency || ""} ${fmt(c.gross_premium)}`} accent="text-blue-600" />
        <StatCard title="Cedant" value={c.cedant || "-"} />
        <StatCard title="Line" value={c.line || "-"} />
        <StatCard title="Policy" value={c.policy_cover_note || "None"} />
        <StatCard title="Drafts" value={c.drafts.length} />
      </div>

      {c.ai_summary && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 mb-5">
          <span className="text-[10px] font-bold text-blue-600 uppercase">AI Analysis</span>
          <div className="prose prose-sm max-w-none text-[12px] mt-1"><ReactMarkdown>{c.ai_summary}</ReactMarkdown></div>
        </div>
      )}

      {c.matched_policy_id && (
        <div className="flex items-center gap-2 mb-5 text-[12px]">
          <span className="font-bold">Matched Policy:</span>
          <a href={`/ins/policies/${c.matched_policy_id}`} className="text-blue-600 font-bold hover:text-blue-800">{c.policy_cover_note} - {c.policy_assured}</a>
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {c.status === "draft_ready" && (
          <button onClick={async () => { setSending(true); await fetchApi(`/api/contract-cases/${id}/send`, { method: "POST" }); setSending(false); load(); }}
            disabled={sending} className="px-4 py-2 bg-blue-600 text-white rounded text-[12px] font-bold hover:bg-blue-700 disabled:opacity-50">
            {sending ? "Sending..." : `Send to ${c.drafts.length} Reinsurers`}
          </button>
        )}
        {c.status === "sent" && (
          <button onClick={async () => { await fetchApi(`/api/contract-cases/${id}/mark-paid`, { method: "POST" }); load(); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded text-[12px] font-bold hover:bg-emerald-700">Mark Paid</button>
        )}
        <button onClick={async () => { if (confirm("Delete?")) { await fetchApi(`/api/contract-cases/${id}`, { method: "DELETE" }); router.push("/ins/contracts/process"); } }}
          className="ml-auto px-3 py-2 border border-red-300 text-red-500 rounded text-[11px] font-semibold hover:bg-red-50">Delete</button>
      </div>

      {/* Drafts */}
      {c.drafts.length > 0 && (
        <div>
          <h2 className="text-[13px] font-extrabold text-slate-900 mb-3">Reinsurer Drafts ({c.drafts.length})</h2>
          <div className="space-y-1.5">
            {c.drafts.map((d) => (
              <div key={d.id} className={`rounded border bg-white overflow-hidden ${d.status === "paid" ? "border-emerald-200" : d.status === "sent" ? "border-amber-200" : "border-slate-200"}`}>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="font-bold text-slate-900">{d.reinsurer}</span>
                    <span className="text-slate-400">{(d.share * 100).toFixed(1)}%</span>
                    <span className="font-bold">{c.currency} {fmt(d.ri_premium)}</span>
                    {d.commission > 0 && <span className="text-slate-400">comm: {fmt(d.commission)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      d.status === "paid" ? "bg-emerald-50 text-emerald-700" : d.status === "sent" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"
                    }`}>{d.status.toUpperCase()}</span>
                    <button onClick={() => setPreviewId(previewId === d.id ? null : d.id)} className="text-[10px] font-bold text-blue-600">
                      {previewId === d.id ? "Close" : "Preview"}
                    </button>
                  </div>
                </div>
                {previewId === d.id && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    <pre className="text-[12px] whitespace-pre-wrap font-mono">{d.body}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 px-4 py-2 rounded border border-slate-200 bg-slate-50 flex justify-between text-[12px]">
            <span className="font-bold text-slate-400">Total RI Premium</span>
            <span className="font-extrabold">{c.currency || "KRW"} {fmt(totalPrem)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
