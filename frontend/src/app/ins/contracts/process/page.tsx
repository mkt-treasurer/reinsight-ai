"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import ClaimIntakeModal from "@/components/ClaimIntakeModal";
import Modal from "@/components/Modal";
import RecordForm from "@/components/RecordForm";

interface Case { id: number; assured: string; cedant: string | null; line: string | null; cover_note_no: string | null; currency: string | null; gross_premium: number | null; status: string; ai_summary: string | null; created_at: string | null; }

const STAGES = [
  { key: "intake", label: "Intake", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { key: "draft_ready", label: "Draft", color: "bg-violet-50 text-violet-700 border-violet-300" },
  { key: "sent", label: "Sent", color: "bg-amber-50 text-amber-700 border-amber-300" },
  { key: "completed", label: "Done", color: "bg-emerald-50 text-emerald-700 border-emerald-300" },
];

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

const intakeFields = [
  { key: "assured", label: "Assured (피보험자)" },
  { key: "cedant", label: "Cedant" },
  { key: "line", label: "Line" },
  { key: "cover_note_no", label: "Cover Note No." },
  { key: "period_from", label: "Period From (YYYY-MM-DD)" },
  { key: "period_to", label: "Period To (YYYY-MM-DD)" },
  { key: "currency", label: "Currency" },
  { key: "gross_premium", label: "Gross Premium", type: "number" as const },
  { key: "description", label: "Description" },
];

export default function ContractDraftsPage() {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<Record<string, number> | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [demos, setDemos] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState<"manual" | "demo">("manual");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchApi<Record<string, number>>("/api/contract-cases/pipeline").then(setPipeline);
    const params = filterStatus ? `?status=${filterStatus}` : "";
    fetchApi<Case[]>(`/api/contract-cases${params}`).then((d) => { setCases(d); setLoading(false); });
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: Record<string, unknown>) => {
    setCreating(true);
    const res = await fetchApi<{ id: number }>("/api/contract-cases", { method: "POST", body: JSON.stringify(data) });
    await fetchApi(`/api/contract-cases/${res.id}/process`, { method: "POST" });
    setCreating(false);
    setShowNew(false);
    router.push(`/ins/contracts/process/${res.id}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">Contract Drafts</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">New contract intake → closing/STMT draft generation</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-[12px] font-bold hover:bg-blue-700">+ New Contract</button>
      </div>

      {/* Pipeline */}
      {pipeline && (
        <div className="flex gap-1.5 mb-5">
          <button onClick={() => setFilterStatus("")}
            className={`px-2.5 py-1 rounded text-[11px] font-bold border ${!filterStatus ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-200"}`}>
            All ({Object.values(pipeline).reduce((a, b) => a + b, 0)})
          </button>
          {STAGES.map((s) => {
            const count = pipeline[s.key] || 0;
            if (count === 0) return null;
            return <button key={s.key} onClick={() => setFilterStatus(s.key)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold border ${filterStatus === s.key ? "bg-blue-600 text-white border-blue-600" : s.color}`}>
              {s.label} ({count})
            </button>;
          })}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded" />)}</div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 border border-slate-200 rounded bg-white text-[13px] text-slate-400">No contract cases yet</div>
      ) : (
        <div className="space-y-1.5">
          {cases.map((c) => {
            const stage = STAGES.find((s) => s.key === c.status) || STAGES[0];
            return (
              <div key={c.id} onClick={() => router.push(`/ins/contracts/process/${c.id}`)}
                className="rounded border border-slate-200 bg-white p-3 hover:bg-blue-50/50 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${stage.color}`}>{stage.label}</span>
                    <span className="text-[13px] font-bold text-slate-900">{c.assured}</span>
                    {c.cover_note_no && <span className="text-[11px] text-slate-400">{c.cover_note_no}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    {c.line && <span className="text-slate-500">{c.line}</span>}
                    {c.gross_premium && <span className="font-bold">{c.currency} {fmt(c.gross_premium)}</span>}
                  </div>
                </div>
                {c.ai_summary && <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{c.ai_summary}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* New Contract Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Contract">
        <div className="flex gap-1 mb-3">
          <button onClick={() => setTab("manual")} className={`px-2.5 py-1 rounded text-[11px] font-bold ${tab === "manual" ? "bg-blue-600 text-white" : "text-slate-500 border border-slate-200"}`}>Manual</button>
          <button onClick={() => { setTab("demo"); if (!demos.length) fetchApi<Record<string, unknown>[]>("/api/contract-cases/demo-data").then(setDemos); }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold ${tab === "demo" ? "bg-blue-600 text-white" : "text-slate-500 border border-slate-200"}`}>Demo</button>
        </div>
        {creating && <div className="rounded border border-blue-200 bg-blue-50 p-2 mb-3 flex items-center gap-2"><div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-[11px] text-blue-700">Processing...</span></div>}
        {tab === "manual" && <RecordForm fields={intakeFields} onSubmit={handleCreate} submitLabel={creating ? "Processing..." : "Create & Process"} />}
        {tab === "demo" && (
          <div className="space-y-1.5">
            {demos.map((d, i) => (
              <div key={i} onClick={() => handleCreate(d)} className="rounded border border-slate-200 p-2.5 hover:bg-blue-50 cursor-pointer">
                <div className="flex justify-between text-[12px]">
                  <span className="font-bold">{d.assured as string}</span>
                  <span className="font-bold">{(d.gross_premium as number)?.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{d.cedant as string} / {d.line as string} / {d.description as string}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
