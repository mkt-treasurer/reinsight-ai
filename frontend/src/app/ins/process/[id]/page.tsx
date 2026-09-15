"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import StatCard from "@/components/StatCard";
import ReactMarkdown from "react-markdown";
import SlipDocument from "@/components/SlipDocument";

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

interface Draft { id: number; reinsurer: string; share: number; amount: number; currency: string; subject: string; body: string; status: string; sent_at: string | null; paid_at: string | null; }
interface CaseDetail {
  id: number; account_name: string; cedant: string | null; line: string | null; ref_no: string | null;
  dol: string | null; currency: string | null; total_amount: number | null; description: string | null;
  matched_policy_id: number | null; duplicate_check: { is_duplicate: boolean; similar_count: number; similar_claims: { claim_id: number; ref_no: string; account_name: string; reinsurer: string; krw_amount: number; match_reason: string }[] } | null;
  ai_summary: string | null; status: string; policy_assured: string | null; policy_cover_note: string | null;
  drafts: Draft[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  intake: { label: "Intake", color: "bg-gray-100 text-gray-700" },
  analyzing: { label: "Analyzing", color: "bg-blue-50 text-blue-700" },
  analyzed: { label: "Analyzed", color: "bg-blue-50 text-blue-700" },
  draft_ready: { label: "Draft Ready", color: "bg-violet-50 text-violet-700" },
  sent: { label: "Sent", color: "bg-amber-50 text-amber-700" },
  awaiting_payment: { label: "Awaiting Payment", color: "bg-orange-50 text-orange-700" },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700" },
};

async function downloadPDF(draft: Draft) {
  const el = document.getElementById(`draft-preview-${draft.id}`);
  if (!el) return;

  // The preview wrapper carries `hidden` (display:none) when the panel
  // isn't open. A display:none ancestor leaves the slip unrendered, so
  // html2canvas would capture a 0x0 canvas and toDataURL would emit
  // "data:," — which jsPDF rejects as "wrong PNG signature". Reveal the
  // wrapper offscreen for capture, then restore.
  const hiddenAncestor = el.closest<HTMLElement>(".hidden");
  const restoreHidden = hiddenAncestor
    ? (() => {
        const prev = {
          position: hiddenAncestor.style.position,
          left: hiddenAncestor.style.left,
          top: hiddenAncestor.style.top,
          pointerEvents: hiddenAncestor.style.pointerEvents,
        };
        hiddenAncestor.classList.remove("hidden");
        hiddenAncestor.style.position = "absolute";
        hiddenAncestor.style.left = "-99999px";
        hiddenAncestor.style.top = "-99999px";
        hiddenAncestor.style.pointerEvents = "none";
        return () => {
          hiddenAncestor.classList.add("hidden");
          hiddenAncestor.style.position = prev.position;
          hiddenAncestor.style.left = prev.left;
          hiddenAncestor.style.top = prev.top;
          hiddenAncestor.style.pointerEvents = prev.pointerEvents;
        };
      })()
    : null;

  el.style.display = "block";
  // Wait one frame so the just-unhidden element is laid out before capture.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  try {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const pdf = new jsPDF("p", "mm", "a4");
    // A4 = 210 × 297 mm. Letterbox-fit so a tall slip doesn't overflow.
    const pageW = 210,
      pageH = 297,
      margin = 10;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = canvas.width / canvas.height;
    let imgWidth = maxW,
      imgHeight = imgWidth / ratio;
    if (imgHeight > maxH) {
      imgHeight = maxH;
      imgWidth = imgHeight * ratio;
    }
    const x = (pageW - imgWidth) / 2;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, margin, imgWidth, imgHeight);
    pdf.save(`SOC_${draft.reinsurer.replace(/\s/g, "_")}.pdf`);
  } finally {
    el.style.display = "";
    restoreHidden?.();
  }
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [c, setCase] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [editBody, setEditBody] = useState("");
  const [sending, setSending] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);

  const load = () => {
    fetchApi<CaseDetail>(`/api/claim-cases/${id}`).then((d) => { setCase(d); setLoading(false); });
  };
  useEffect(() => { load(); }, [id]);

  const handleSend = async () => { setSending(true); await fetchApi(`/api/claim-cases/${id}/send`, { method: "POST" }); setSending(false); load(); };
  const handleMarkPaid = async (draftId?: number) => { await fetchApi(`/api/claim-cases/${id}/mark-paid${draftId ? `?draft_id=${draftId}` : ""}`, { method: "POST" }); load(); };
  const handleSaveDraft = async () => { if (!editDraft) return; await fetchApi(`/api/claim-cases/${id}/drafts/${editDraft.id}?body=${encodeURIComponent(editBody)}`, { method: "PUT" }); setEditDraft(null); load(); };

  if (loading || !c) return (
    <div className="animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
      <div className="h-7 w-64 bg-gray-200 rounded mb-5" />
      <div className="grid grid-cols-6 gap-3 mb-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-20 bg-blue-100 rounded-lg mb-5" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );

  const st = STATUS_LABELS[c.status] || STATUS_LABELS.intake;
  const totalDraftAmt = c.drafts.reduce((s, d) => s + (d.amount || 0), 0);
  const paidDrafts = c.drafts.filter((d) => d.status === "paid").length;

  return (
    <div>
      <div className="mb-5">
        <button onClick={() => router.push("/ins/process")} className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 mb-2 block">&lt; Back</button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold text-black">{c.account_name}</h1>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${st.color}`}>{st.label}</span>
          {c.ref_no && <span className="text-[12px] text-gray-400">{c.ref_no}</span>}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-5">
        <StatCard title="Amount" value={`${c.currency || ""} ${fmt(c.total_amount)}`} accent="text-blue-600" />
        <StatCard title="Cedant" value={c.cedant || "-"} />
        <StatCard title="Line" value={c.line || "-"} />
        <StatCard title="DOL" value={c.dol || "-"} />
        <StatCard title="Policy" value={c.policy_cover_note || "None"} accent={c.matched_policy_id ? "text-blue-600" : "text-red-600"} />
        <StatCard title="Drafts" value={`${c.drafts.length} (${paidDrafts} paid)`} />
      </div>

      {/* AI Summary - Markdown */}
      {c.ai_summary && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-5">
          <span className="text-[11px] font-bold text-blue-600 uppercase mb-2 block">AI Analysis</span>
          <div className="prose prose-sm max-w-none text-[13px] text-black
            prose-strong:text-black prose-strong:font-extrabold
            prose-h2:text-[14px] prose-h2:font-extrabold prose-h2:mt-2 prose-h2:mb-1
            prose-p:my-1 prose-ul:my-1 prose-li:my-0">
            <ReactMarkdown>{c.ai_summary}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {c.duplicate_check?.is_duplicate && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-5">
          <span className="text-[11px] font-bold text-red-600 uppercase">Duplicate Warning</span>
          <p className="text-[13px] text-black mt-1">{c.duplicate_check.similar_count} similar claim(s) found</p>
          <div className="mt-2 space-y-1">
            {c.duplicate_check.similar_claims.map((s, i) => (
              <div key={i} className="text-[12px] flex gap-3">
                <span className="font-bold">{s.account_name}</span>
                <span className="text-gray-500">{s.reinsurer}</span>
                <span className="font-medium">{fmt(s.krw_amount)}</span>
                <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">{s.match_reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Policy link */}
      {c.matched_policy_id && (
        <div className="flex items-center gap-2 mb-5 text-[13px]">
          <span className="font-bold text-black">Matched Policy:</span>
          <a href={`/ins/policies/${c.matched_policy_id}`} className="text-blue-600 font-bold hover:text-blue-800">{c.policy_cover_note} - {c.policy_assured}</a>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-5">
        {c.status === "draft_ready" && (
          <button onClick={handleSend} disabled={sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50">
            {sending ? "Sending..." : `Send to ${c.drafts.length} Reinsurers`}
          </button>
        )}
        {(c.status === "sent" || c.status === "awaiting_payment") && (
          <button onClick={() => handleMarkPaid()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-[13px] font-bold hover:bg-emerald-700">Mark All Paid</button>
        )}
        {c.status === "intake" && (
          <button onClick={async () => { await fetchApi(`/api/claim-cases/${id}/process`, { method: "POST" }); load(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700">Run AI Analysis</button>
        )}
        <button onClick={async () => {
          if (!confirm("Delete this case? It can be restored later.")) return;
          await fetchApi(`/api/claim-cases/${id}`, { method: "DELETE" });
          router.push("/ins/process");
        }} className="ml-auto px-3 py-2 border border-red-300 text-red-500 rounded text-[12px] font-semibold hover:bg-red-50">
          Delete
        </button>
      </div>

      {/* Drafts */}
      {c.drafts.length > 0 && (
        <div>
          <h2 className="text-[14px] font-extrabold text-black mb-3">Reinsurer Drafts ({c.drafts.length})</h2>
          <div className="space-y-2">
            {c.drafts.map((d) => (
              <div key={d.id} className={`rounded-lg border bg-white overflow-hidden ${d.status === "paid" ? "border-emerald-200" : d.status === "sent" ? "border-amber-200" : "border-gray-200"}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold text-black">{d.reinsurer}</span>
                    <span className="text-[12px] text-gray-400">{(d.share * 100).toFixed(1)}%</span>
                    <span className="text-[13px] font-bold">{d.currency} {fmt(d.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      d.status === "paid" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      d.status === "sent" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      "bg-gray-50 text-gray-600 border border-gray-200"
                    }`}>{d.status.toUpperCase()}</span>
                    <button onClick={() => setPreviewDraft(previewDraft?.id === d.id ? null : d)}
                      className="text-[11px] font-bold text-blue-600">Preview</button>
                    <button onClick={() => downloadPDF(d)}
                      className="text-[11px] font-bold text-violet-600">PDF</button>
                    {d.status === "draft" && (
                      <button onClick={() => { setEditDraft(d); setEditBody(d.body); }}
                        className="text-[11px] font-bold text-amber-600">Edit</button>
                    )}
                    {d.status === "sent" && (
                      <button onClick={() => handleMarkPaid(d.id)}
                        className="text-[11px] font-bold text-emerald-600">Mark Paid</button>
                    )}
                  </div>
                </div>

                {/* Preview panel — always mount when case is loaded so PDF
                    download can capture the slip even when collapsed. */}
                {c && (
                  <div
                    className={`border-t border-gray-200 bg-gray-100 p-6 flex justify-center overflow-x-auto ${
                      previewDraft?.id === d.id ? "" : "hidden"
                    }`}
                  >
                    <div className="border border-gray-300 shadow-lg">
                      <SlipDocument
                        id={`draft-preview-${d.id}`}
                        toReinsurer={d.reinsurer}
                        date={new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        cedantRef={c.ref_no || "Refer to the list"}
                        reinsured={c.cedant || "N/A"}
                        insured={c.account_name}
                        claimType={c.line || "N/A"}
                        policyPeriod={c.policy_cover_note ? `Refer to ${c.policy_cover_note}` : "N/A"}
                        dol={c.dol || "TBD"}
                        locationOfLoss="-"
                        particulars={c.description || "Refer to the list"}
                        remarks="-"
                        currency={d.currency}
                        claimAmount100={c.total_amount || 0}
                        expense100={0}
                        total100={c.total_amount || 0}
                        yourShare={d.share}
                        yourAmount={d.amount}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 flex justify-between text-[13px]">
            <span className="font-bold text-gray-400">Total</span>
            <span className="font-extrabold text-black">{c.currency || "KRW"} {fmt(totalDraftAmt)}</span>
          </div>
        </div>
      )}

      {/* Edit draft modal */}
      {editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditDraft(null)} />
          <div className="relative bg-white rounded-lg border shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-[14px] font-extrabold text-black">Edit Draft - {editDraft.reinsurer}</h2>
              <button onClick={() => setEditDraft(null)} className="text-gray-400 hover:text-black font-bold">x</button>
            </div>
            <div className="p-5">
              <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
                className="w-full h-64 px-3 py-2 border border-gray-200 rounded-md text-[13px] font-mono focus:outline-none focus:border-blue-500" />
              <button onClick={handleSaveDraft}
                className="mt-3 w-full py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700">Save Draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
