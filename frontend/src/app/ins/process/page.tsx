"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import Modal from "@/components/Modal";
import RecordForm from "@/components/RecordForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

interface Pipeline { intake: number; analyzing: number; analyzed: number; draft_ready: number; review: number; sent: number; awaiting_payment: number; completed: number; }
interface Case { id: number; account_name: string; cedant: string | null; line: string | null; ref_no: string | null; total_amount: number | null; currency: string | null; status: string; ai_summary: string | null; created_at: string | null; }

const STAGES = [
  { key: "intake", label: "Intake", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { key: "analyzing", label: "Analyzing", color: "bg-blue-50 text-blue-700 border-blue-300" },
  { key: "draft_ready", label: "Draft Ready", color: "bg-violet-50 text-violet-700 border-violet-300" },
  { key: "sent", label: "Sent", color: "bg-amber-50 text-amber-700 border-amber-300" },
  { key: "awaiting_payment", label: "Awaiting Payment", color: "bg-orange-50 text-orange-700 border-orange-300" },
  { key: "completed", label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-300" },
];

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

const customFields = [
  { key: "account_name", label: "Account Name" },
  { key: "cedant", label: "Cedant" },
  { key: "line", label: "Line" },
  { key: "ref_no", label: "Ref No." },
  { key: "dol", label: "Date of Loss" },
  { key: "currency", label: "Currency" },
  { key: "total_amount", label: "Total Amount", type: "number" as const },
  { key: "description", label: "Description" },
];

type IntakeTab = "paste" | "msg" | "demo" | "custom";

export default function ProcessPage() {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState<IntakeTab>("paste");
  const [processing, setProcessing] = useState(false);

  // Paste state
  const [pasteText, setPasteText] = useState("");
  const [pasteFiles, setPasteFiles] = useState<FileList | null>(null);

  // MSG state
  const [msgFile, setMsgFile] = useState<File | null>(null);

  // Demo state
  const [demos, setDemos] = useState<Record<string, unknown>[]>([]);

  const [loadingList, setLoadingList] = useState(true);

  // Extracted data for review
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);

  // Demo selected detail
  const [selectedDemo, setSelectedDemo] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    fetchApi<Pipeline>("/api/claim-cases/pipeline").then(setPipeline);
    const params = filterStatus ? `?status=${filterStatus}` : "";
    fetchApi<Case[]>(`/api/claim-cases${params}`).then((d) => { setCases(d); setLoadingList(false); });
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const loadDemos = async () => {
    const data = await fetchApi<Record<string, unknown>[]>("/api/claim-cases/demo-data");
    setDemos(data);
  };

  const handlePasteExtract = async () => {
    if (!pasteText.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API_URL}/api/claim-cases/parse-email?email_text=${encodeURIComponent(pasteText)}`, { method: "POST" });
      const data = await res.json();
      if (data.error) { alert(data.error); } else { setExtracted(data); }
    } finally { setProcessing(false); }
  };

  const handleMsgExtract = async () => {
    if (!msgFile) return;
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("msg_file", msgFile);
      const res = await fetch(`${API_URL}/api/claim-cases/parse-email`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { alert(data.error); } else { setExtracted(data); }
    } finally { setProcessing(false); }
  };

  const handleSubmitExtracted = async (data: Record<string, unknown>) => {
    setProcessing(true);
    const res = await fetchApi<Case>("/api/claim-cases", { method: "POST", body: JSON.stringify(data) });
    await fetchApi(`/api/claim-cases/${res.id}/process`, { method: "POST" });
    setProcessing(false);
    setShowNew(false);
    setExtracted(null);
    setPasteText("");
    setMsgFile(null);
    load();
    router.push(`/ins/process/${res.id}`);
  };

  const handleCustomSubmit = async (data: Record<string, unknown>) => {
    await handleSubmitExtracted(data);
  };

  const handleDemoSelect = (demo: Record<string, unknown>) => {
    setExtracted(demo);
  };

  const TABS: { key: IntakeTab; label: string; desc: string }[] = [
    { key: "paste", label: "Email Paste", desc: "Copy & paste email content" },
    { key: "msg", label: "MSG File", desc: "Upload Outlook .msg file" },
    { key: "demo", label: "Demo Data", desc: "Load sample claim data" },
    { key: "custom", label: "Manual Entry", desc: "Enter fields manually" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-black">Claim Processing</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">New claim intake, AI analysis, draft generation, and send</p>
        </div>
        <button onClick={() => { setShowNew(true); setExtracted(null); setTab("paste"); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700">
          + New Claim
        </button>
      </div>

      {/* Pipeline stages */}
      {pipeline && (
        <div className="flex gap-2 mb-5">
          <button onClick={() => setFilterStatus("")}
            className={`px-3 py-2 rounded-md text-[12px] font-bold border transition-colors ${!filterStatus ? "bg-blue-600 text-white border-blue-600" : "bg-white text-black border-gray-200"}`}>
            All ({Object.values(pipeline).reduce((a, b) => a + b, 0)})
          </button>
          {STAGES.map((s) => {
            const count = pipeline[s.key as keyof Pipeline] || 0;
            if (count === 0 && s.key !== "intake") return null;
            return (
              <button key={s.key} onClick={() => setFilterStatus(s.key)}
                className={`px-3 py-2 rounded-md text-[12px] font-bold border transition-colors ${filterStatus === s.key ? "bg-blue-600 text-white border-blue-600" : s.color}`}>
                {s.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Cases list */}
      {loadingList ? (
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 rounded-lg bg-white">
          <p className="text-[14px] font-bold text-black mb-2">No claim cases</p>
          <p className="text-[12px] text-gray-400 mb-4">Create a new claim to start processing</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => {
            const stage = STAGES.find((s) => s.key === c.status) || STAGES[0];
            return (
              <div key={c.id} onClick={() => router.push(`/ins/process/${c.id}`)}
                className="rounded-lg border border-gray-200 bg-white p-4 hover:bg-blue-50 cursor-pointer transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${stage.color}`}>{stage.label}</span>
                    <span className="text-[14px] font-bold text-black">{c.account_name}</span>
                    {c.ref_no && <span className="text-[12px] text-gray-400">{c.ref_no}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-[12px]">
                    {c.line && <span className="text-gray-500">{c.line}</span>}
                    {c.cedant && <span className="text-gray-500">{c.cedant}</span>}
                    {c.total_amount && <span className="font-bold text-black">{c.currency} {fmt(c.total_amount)}</span>}
                  </div>
                </div>
                {c.ai_summary && (
                  <p className="text-[12px] text-gray-500 mt-2 line-clamp-1">{c.ai_summary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Claim Modal */}
      <Modal open={showNew} onClose={() => { setShowNew(false); setExtracted(null); }} title="New Claim Intake">
        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setExtracted(null); }}
              className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors ${
                tab === t.key ? "bg-blue-600 text-white" : "text-black border border-gray-200 hover:bg-gray-50"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Extracted data review */}
        {extracted && tab !== "custom" ? (
          <div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 mb-4">
              <span className="text-[11px] font-bold text-emerald-600 uppercase">AI Extracted Data</span>
              <p className="text-[12px] text-gray-500 mt-0.5">Review and edit before submitting</p>
            </div>
            <RecordForm
              fields={customFields}
              initial={extracted}
              onSubmit={handleSubmitExtracted}
              submitLabel={processing ? "Processing..." : "Create & Analyze"}
            />
          </div>
        ) : (
          <>
            {/* Tab 1: Paste */}
            {tab === "paste" && (
              <div>
                <p className="text-[12px] text-gray-400 mb-3">Paste the email content below. AI will extract claim data.</p>
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste email content here...&#10;&#10;e.g. SOC notification, PLA, claim advice..."
                  className="w-full h-40 px-3 py-2 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 mb-3" />
                <div className="mb-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">Attachments (optional)</label>
                  <input type="file" multiple onChange={(e) => setPasteFiles(e.target.files)}
                    className="text-[12px] text-gray-500" />
                </div>
                <button onClick={handlePasteExtract} disabled={!pasteText.trim() || processing}
                  className="w-full py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50">
                  {processing ? "Extracting..." : "Extract with AI"}
                </button>
              </div>
            )}

            {/* Tab 2: MSG File */}
            {tab === "msg" && (
              <div>
                <p className="text-[12px] text-gray-400 mb-3">Upload an Outlook .msg file. AI will parse and extract claim data.</p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setMsgFile(f); }}>
                  <input type="file" accept=".msg" onChange={(e) => { if (e.target.files?.[0]) setMsgFile(e.target.files[0]); }}
                    className="hidden" id="msg-upload" />
                  <label htmlFor="msg-upload" className="cursor-pointer">
                    {msgFile ? (
                      <div>
                        <p className="text-[13px] font-bold text-black">{msgFile.name}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{(msgFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[13px] font-medium text-gray-500">Drop .msg file here or click to select</p>
                        <p className="text-[11px] text-gray-400 mt-1">Outlook email file (.msg)</p>
                      </div>
                    )}
                  </label>
                </div>
                <button onClick={handleMsgExtract} disabled={!msgFile || processing}
                  className="w-full py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50">
                  {processing ? "Parsing..." : "Parse & Extract"}
                </button>
              </div>
            )}

            {/* Tab 3: Demo */}
            {tab === "demo" && (
              <div>
                <p className="text-[12px] text-gray-400 mb-3">Select sample claim data with attached files.</p>
                {demos.length === 0 ? (
                  <button onClick={loadDemos}
                    className="w-full py-3 border border-gray-200 rounded-lg text-[13px] font-bold text-blue-600 hover:bg-blue-50 mb-3">
                    Load Demo Data
                  </button>
                ) : selectedDemo ? (
                  <div>
                    {/* Selected demo detail */}
                    <button onClick={() => setSelectedDemo(null)}
                      className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 mb-3 block">&lt; Back to list</button>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-bold text-black">{selectedDemo.account_name as string}</span>
                        <span className="text-[13px] font-bold text-blue-700">{selectedDemo.currency as string} {fmt(selectedDemo.total_amount as number)}</span>
                      </div>
                      <div className="flex gap-3 text-[12px] text-gray-500 mt-1">
                        <span>{selectedDemo.cedant as string}</span>
                        <span>{selectedDemo.line as string}</span>
                        <span>{selectedDemo.ref_no as string}</span>
                      </div>
                      <p className="text-[12px] text-gray-600 mt-1">{selectedDemo.description as string}</p>
                    </div>

                    {/* Files */}
                    {((selectedDemo.files as { name: string; path: string }[]) || []).length > 0 && (
                      <div className="mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-2">Attached Files</span>
                        <div className="space-y-1">
                          {(selectedDemo.files as { name: string; path: string }[]).map((f, i) => {
                            const fileUrl = `${API_URL}/files/${encodeURI(f.path)}`;
                            const isPdf = f.name.endsWith(".pdf");
                            return (
                              <div key={i} className="rounded-md border border-gray-200 bg-white overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2">
                                  <span className="text-[12px] font-medium text-black">{f.name}</span>
                                  <div className="flex gap-2">
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800">Open</a>
                                  </div>
                                </div>
                                {isPdf && (
                                  <iframe src={fileUrl} className="w-full border-t border-gray-200" style={{ height: 300 }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button onClick={() => { handleDemoSelect(selectedDemo); setSelectedDemo(null); }}
                      className="w-full py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700">
                      Use This Claim
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {demos.map((d, i) => {
                      const files = (d.files as { name: string }[]) || [];
                      return (
                        <div key={i} onClick={() => setSelectedDemo(d)}
                          className="rounded-lg border border-gray-200 p-3 hover:bg-blue-50 cursor-pointer transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-black">{d.account_name as string}</span>
                            <span className="text-[12px] font-bold">{d.currency as string} {fmt(d.total_amount as number)}</span>
                          </div>
                          <div className="flex gap-3 text-[11px] text-gray-400 mt-1">
                            <span>{d.cedant as string}</span>
                            <span>{d.line as string}</span>
                            <span>{d.ref_no as string}</span>
                            <span>{d.description as string}</span>
                          </div>
                          {files.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {files.map((f, fi) => (
                                <span key={fi} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                  {f.name.split(".").pop()?.toUpperCase()}
                                </span>
                              ))}
                              <span className="text-[10px] text-gray-400 ml-1">{files.length} files</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Custom */}
            {tab === "custom" && (
              <div>
                <p className="text-[12px] text-gray-400 mb-3">Enter claim details manually.</p>
                <RecordForm
                  fields={customFields}
                  onSubmit={handleCustomSubmit}
                  submitLabel={processing ? "Processing..." : "Create & Analyze"}
                />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
