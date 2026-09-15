"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import Modal from "@/components/Modal";
import RecordForm from "@/components/RecordForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

type Tab = "paste" | "msg" | "demo" | "custom";

const intakeFields = [
  { key: "account_name", label: "Account Name" },
  { key: "cedant", label: "Cedant" },
  { key: "line", label: "Line" },
  { key: "ref_no", label: "Ref No." },
  { key: "dol", label: "Date of Loss" },
  { key: "currency", label: "Currency" },
  { key: "total_amount", label: "Total Amount", type: "number" as const },
  { key: "description", label: "Description" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ClaimIntakeModal({ open, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("paste");
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");

  // Paste
  const [pasteText, setPasteText] = useState("");

  // MSG
  const [msgFile, setMsgFile] = useState<File | null>(null);

  // Demo
  const [demos, setDemos] = useState<Record<string, unknown>[]>([]);
  const [selectedDemo, setSelectedDemo] = useState<Record<string, unknown> | null>(null);

  // Extracted
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);

  const reset = () => {
    setTab("paste");
    setPasteText("");
    setMsgFile(null);
    setExtracted(null);
    setSelectedDemo(null);
    setStatus("");
    setProcessing(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const submitAndProcess = async (data: Record<string, unknown>) => {
    setProcessing(true);
    setStatus("Creating claim case...");
    const caseRes = await fetchApi<{ id: number }>("/api/claim-cases", { method: "POST", body: JSON.stringify(data) });
    setStatus("Running AI analysis...");
    await fetchApi(`/api/claim-cases/${caseRes.id}/process`, { method: "POST" });
    setStatus("Done! Redirecting...");
    handleClose();
    router.push(`/ins/process/${caseRes.id}`);
  };

  const extractFromPaste = async () => {
    if (!pasteText.trim()) return;
    setProcessing(true);
    setStatus("Extracting with AI...");
    const res = await fetch(`${API_URL}/api/claim-cases/parse-email?email_text=${encodeURIComponent(pasteText)}`, { method: "POST" });
    const data = await res.json();
    setProcessing(false);
    setStatus("");
    if (data.error) { alert(data.error); } else { setExtracted(data); }
  };

  const extractFromMsg = async () => {
    if (!msgFile) return;
    setProcessing(true);
    setStatus("Parsing MSG file...");
    const formData = new FormData();
    formData.append("msg_file", msgFile);
    const res = await fetch(`${API_URL}/api/claim-cases/parse-email`, { method: "POST", body: formData });
    const data = await res.json();
    setProcessing(false);
    setStatus("");
    if (data.error) { alert(data.error); } else { setExtracted(data); }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "paste", label: "Email" },
    { key: "msg", label: "MSG" },
    { key: "demo", label: "Demo" },
    { key: "custom", label: "Manual" },
  ];

  return (
    <Modal open={open} onClose={handleClose} title="New Claim">
      {/* Processing overlay */}
      {processing && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 mb-3 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] font-medium text-blue-700">{status}</span>
        </div>
      )}

      {/* Tabs */}
      {!extracted && !processing && (
        <div className="flex gap-1 mb-3">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                tab === t.key ? "bg-blue-600 text-white" : "text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Extracted → review form */}
      {extracted && !processing ? (
        <div>
          <div className="rounded border border-emerald-200 bg-emerald-50 p-2 mb-3 text-[11px] text-emerald-700 font-medium">
            AI extracted — review and submit
          </div>
          <RecordForm fields={intakeFields} initial={extracted} onSubmit={submitAndProcess} submitLabel="Create & Process" />
        </div>
      ) : !processing && (
        <>
          {tab === "paste" && (
            <div>
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste email / SOC / PLA content..."
                className="w-full h-32 px-3 py-2 border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 mb-2" />
              <button onClick={extractFromPaste} disabled={!pasteText.trim()}
                className="w-full py-2 bg-blue-600 text-white rounded text-[12px] font-bold hover:bg-blue-700 disabled:opacity-40">
                Extract with AI
              </button>
            </div>
          )}

          {tab === "msg" && (
            <div>
              <div className="border-2 border-dashed border-slate-300 rounded p-6 text-center mb-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setMsgFile(e.dataTransfer.files[0]); }}>
                <input type="file" accept=".msg" onChange={(e) => { if (e.target.files?.[0]) setMsgFile(e.target.files[0]); }}
                  className="hidden" id="claim-msg" />
                <label htmlFor="claim-msg" className="cursor-pointer text-[12px] text-slate-500">
                  {msgFile ? <span className="font-bold text-slate-900">{msgFile.name}</span> : "Drop .msg or click"}
                </label>
              </div>
              <button onClick={extractFromMsg} disabled={!msgFile}
                className="w-full py-2 bg-blue-600 text-white rounded text-[12px] font-bold hover:bg-blue-700 disabled:opacity-40">
                Parse & Extract
              </button>
            </div>
          )}

          {tab === "demo" && (
            <div>
              {demos.length === 0 ? (
                <button onClick={async () => { const d = await fetchApi<Record<string, unknown>[]>("/api/claim-cases/demo-data"); setDemos(d); }}
                  className="w-full py-3 border border-slate-200 rounded text-[12px] font-bold text-blue-600 hover:bg-blue-50">
                  Load Demo Data
                </button>
              ) : (
                <div className="space-y-1.5">
                  {demos.map((d, i) => (
                    <div key={i} onClick={() => setExtracted(d)}
                      className="rounded border border-slate-200 p-2.5 hover:bg-blue-50 cursor-pointer">
                      <div className="flex justify-between text-[12px]">
                        <span className="font-bold text-slate-900">{d.account_name as string}</span>
                        <span className="font-bold">{(d.total_amount as number)?.toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{d.cedant as string} / {d.line as string} / {d.description as string}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "custom" && (
            <RecordForm fields={intakeFields} onSubmit={submitAndProcess} submitLabel="Create & Process" />
          )}
        </>
      )}
    </Modal>
  );
}
