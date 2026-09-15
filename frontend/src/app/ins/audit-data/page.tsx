"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import StatCard from "@/components/StatCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

// Types for claims audit
interface AmountDiff { reinsurer: string; file_amount: number; db_amount: number; diff: number; }
interface Extraction { file: string; type: string; total_100: number; currency?: string; }
interface ClaimMatch {
  ref_no: string; account_name: string; reinsurers: string[]; claim_count: number;
  total_krw: number; file_count: number; file_types: string[]; claim_type: string; date: string;
  files: { name: string; path: string; type: string }[];
  file_total_100: number | null; file_currency: string | null;
  amount_status: string; amount_diffs: AmountDiff[];
  extractions: Extraction[]; cross_file_ok: boolean;
}
interface ClaimNoFile { ref_no: string; account_name: string; reinsurers: string[]; claim_count: number; total_krw: number; }
interface OrphanFile { ref_no: string; company: string; claim_type: string; date: string; file_count: number; }
interface ClaimAuditResult {
  total_claims_checked: number; matched: number; no_file: number; orphan_files: number; total_file_refs: number;
  matched_details: ClaimMatch[]; no_file_details: ClaimNoFile[]; orphan_file_details: OrphanFile[];
}

type AuditMode = "claims" | "premium";

export default function AuditDataPage() {
  const [mode, setMode] = useState<AuditMode>("claims");
  const [claimResult, setClaimResult] = useState<ClaimAuditResult | null>(null);
  const [premiumResult, setPremiumResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimTab, setClaimTab] = useState<"matched" | "no_file" | "orphan">("matched");
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{ total_files: number; processed: number; parsed: number; failed: number; remaining: number; progress_pct: number } | null>(null);
  const [tagging, setTagging] = useState(false);
  const [tagProgress, setTagProgress] = useState<{ total: number; pending: number; parsed: number; failed: number; progress_pct: number } | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [msgContent, setMsgContent] = useState<Record<string, unknown> | null>(null);

  const runClaimAudit = async () => {
    setLoading(true);
    const data = await fetchApi<ClaimAuditResult>("/api/audit-data/claims", { method: "POST" });
    setClaimResult(data);
    setLoading(false);
  };

  const runPremiumAudit = async () => {
    setLoading(true);
    const data = await fetchApi<Record<string, unknown>>("/api/audit-data/premium", { method: "POST" });
    setPremiumResult(data);
    setLoading(false);
  };

  // Auto-load on mount
  useEffect(() => {
    runClaimAudit();
    fetchApi<typeof tagProgress>("/api/audit-data/tag-progress").then(setTagProgress);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-black">Data Audit</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Compare database records with actual files</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setMode("claims")}
          className={`px-4 py-2 rounded-md text-[13px] font-bold transition-colors ${mode === "claims" ? "bg-blue-600 text-white" : "text-black border border-gray-200 hover:bg-gray-50"}`}>
          Claims vs Files
        </button>
        <button onClick={() => setMode("premium")}
          className={`px-4 py-2 rounded-md text-[13px] font-bold transition-colors ${mode === "premium" ? "bg-blue-600 text-white" : "text-black border border-gray-200 hover:bg-gray-50"}`}>
          Premium STMT vs DB
        </button>
        <button onClick={mode === "claims" ? runClaimAudit : runPremiumAudit} disabled={loading}
          className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Auditing..." : "Run Audit"}
        </button>
        {mode === "claims" && (
          <button onClick={async () => {
            setTagging(true);
            await fetchApi("/api/audit-data/tag-all", { method: "POST" });
            const poll = setInterval(async () => {
              const p = await fetchApi<typeof tagProgress>("/api/audit-data/tag-progress");
              setTagProgress(p);
              if (p && p.pending === 0) {
                clearInterval(poll);
                setTagging(false);
                runClaimAudit();
              }
            }, 3000);
          }} disabled={tagging}
            className="px-4 py-2 border border-violet-600 text-violet-600 rounded-md text-[13px] font-bold hover:bg-violet-50 disabled:opacity-50">
            {tagging ? "Tagging..." : "Tag All Files (AI)"}
          </button>
        )}
        {mode === "claims" && tagProgress && tagProgress.failed > 0 && (
          <button onClick={async () => {
            await fetchApi("/api/audit-data/retry-failed", { method: "POST" });
            setTagging(true);
            await fetchApi("/api/audit-data/tag-all", { method: "POST" });
            const poll = setInterval(async () => {
              const p = await fetchApi<typeof tagProgress>("/api/audit-data/tag-progress");
              setTagProgress(p);
              if (p && p.pending === 0) {
                clearInterval(poll);
                setTagging(false);
                runClaimAudit();
              }
            }, 3000);
          }} disabled={tagging}
            className="px-3 py-2 border border-red-500 text-red-500 rounded-md text-[13px] font-bold hover:bg-red-50 disabled:opacity-50">
            Retry {tagProgress.failed} Failed
          </button>
        )}
        {mode === "claims" && (
          <button onClick={async () => {
            setExtracting(true);
            await fetchApi("/api/audit-data/extract-all", { method: "POST" });
            // Poll progress
            const poll = setInterval(async () => {
              const p = await fetchApi<typeof extractProgress>("/api/audit-data/extract-progress");
              setExtractProgress(p);
              if (p && p.remaining === 0) {
                clearInterval(poll);
                setExtracting(false);
                runClaimAudit();
              }
            }, 3000);
          }} disabled={extracting}
            className="px-4 py-2 border border-emerald-600 text-emerald-600 rounded-md text-[13px] font-bold hover:bg-emerald-50 disabled:opacity-50">
            {extracting ? "Extracting..." : "Extract All Files"}
          </button>
        )}
      </div>

      {/* Tag progress */}
      {tagProgress && tagProgress.total > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 mb-4">
          <div className="flex items-center justify-between text-[12px] mb-2">
            <span className="font-bold text-black">AI File Tagging</span>
            <div className="flex gap-3">
              <span className="text-emerald-600 font-bold">{tagProgress.parsed} tagged</span>
              {tagProgress.failed > 0 && <span className="text-red-600 font-bold">{tagProgress.failed} failed</span>}
              <span className="text-gray-400">{tagProgress.pending} pending</span>
              <span className="font-bold text-black">{tagProgress.progress_pct}%</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-violet-500 h-2 rounded-full transition-all duration-500" style={{ width: `${tagProgress.progress_pct}%` }} />
          </div>
        </div>
      )}

      {/* Extraction progress */}
      {extractProgress && extractProgress.total_files > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 mb-4">
          <div className="flex items-center justify-between text-[12px] mb-2">
            <span className="font-bold text-black">File Extraction</span>
            <div className="flex gap-3">
              <span className="text-emerald-600 font-bold">{extractProgress.parsed} parsed</span>
              {extractProgress.failed > 0 && <span className="text-red-600 font-bold">{extractProgress.failed} failed</span>}
              <span className="text-gray-400">{extractProgress.remaining} remaining</span>
              <span className="font-bold text-black">{extractProgress.progress_pct}%</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${extractProgress.progress_pct}%` }} />
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 border border-blue-200 rounded-lg bg-blue-50 text-[13px] text-blue-700 font-medium">
          Scanning files and comparing with database...
        </div>
      )}

      {/* Claims Audit */}
      {mode === "claims" && claimResult && !loading && (
        <>
          <div className="grid grid-cols-5 gap-3 mb-5">
            <StatCard title="Claims Checked" value={claimResult.total_claims_checked} />
            <StatCard title="Files Found" value={claimResult.matched} accent="text-emerald-600" />
            <StatCard title="No File" value={claimResult.no_file} accent={claimResult.no_file > 0 ? "text-red-600" : "text-emerald-600"} />
            <StatCard title="Orphan Files" value={claimResult.orphan_files} accent={claimResult.orphan_files > 0 ? "text-amber-600" : undefined} />
            <StatCard title="File Refs" value={claimResult.total_file_refs} />
          </div>

          <div className="flex gap-1 mb-4">
            <button onClick={() => setClaimTab("matched")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors ${claimTab === "matched" ? "bg-emerald-600 text-white" : "text-black border border-gray-200"}`}>
              Matched ({claimResult.matched})
            </button>
            <button onClick={() => setClaimTab("no_file")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors ${claimTab === "no_file" ? "bg-red-600 text-white" : "text-black border border-gray-200"}`}>
              No File ({claimResult.no_file})
            </button>
            <button onClick={() => setClaimTab("orphan")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors ${claimTab === "orphan" ? "bg-amber-600 text-white" : "text-black border border-gray-200"}`}>
              Orphan Files ({claimResult.orphan_files})
            </button>
          </div>

          {/* Matched claims with files */}
          {claimTab === "matched" && (
            <div className="space-y-1">
              {claimResult.matched_details.map((m) => (
                <div key={m.ref_no} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <div onClick={() => setExpandedRef(expandedRef === m.ref_no ? null : m.ref_no)}
                    className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                    <span className="text-[11px] text-gray-400 mr-2">{expandedRef === m.ref_no ? "v" : ">"}</span>
                    <span className="text-[13px] font-bold text-black flex-1">{m.ref_no}</span>
                    <div className="flex items-center gap-3 text-[12px]">
                      <span className="text-gray-500">{m.account_name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{m.claim_type}</span>
                      <span className="font-bold">DB: {fmt(m.total_krw)}</span>
                      {m.file_total_100 != null && (
                        <span className="font-bold text-gray-500">File: {m.file_currency} {fmt(m.file_total_100)}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        m.amount_status === "match" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        m.amount_status === "mismatch" ? "bg-red-50 text-red-600 border border-red-200" :
                        "bg-gray-50 text-gray-500 border border-gray-200"
                      }`}>{m.amount_status === "match" ? "MATCH" : m.amount_status === "mismatch" ? "DIFF" : "NO DATA"}</span>
                      <span className="text-gray-400">{m.file_count} files</span>
                      {!m.cross_file_ok && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200">FILES DIFFER</span>
                      )}
                    </div>
                  </div>
                  {expandedRef === m.ref_no && (
                    <div className="border-t border-gray-200 bg-gray-50 p-3">
                      {/* Amount diffs */}
                      {m.amount_diffs.length > 0 && (
                        <div className="mb-3 rounded border border-red-200 bg-red-50 overflow-hidden">
                          <div className="px-3 py-1.5 text-[11px] font-bold text-red-600 uppercase">Amount Differences</div>
                          <table className="w-full text-[12px]">
                            <thead><tr className="border-t border-red-200 bg-red-50/50">
                              <th className="text-left px-3 py-1.5 text-[10px] font-bold text-red-400">Reinsurer</th>
                              <th className="text-right px-3 py-1.5 text-[10px] font-bold text-red-400">File</th>
                              <th className="text-right px-3 py-1.5 text-[10px] font-bold text-red-400">DB</th>
                              <th className="text-right px-3 py-1.5 text-[10px] font-bold text-red-400">Diff</th>
                            </tr></thead>
                            <tbody>{m.amount_diffs.map((ad, i) => (
                              <tr key={i} className="border-t border-red-100">
                                <td className="px-3 py-1.5 font-bold text-black">{ad.reinsurer}</td>
                                <td className="px-3 py-1.5 text-right">{fmt(ad.file_amount)}</td>
                                <td className="px-3 py-1.5 text-right">{fmt(ad.db_amount)}</td>
                                <td className="px-3 py-1.5 text-right font-bold text-red-600">{fmt(ad.diff)}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )}
                      {/* Cross-source integrity table */}
                      {m.extractions.length > 0 && (
                        <div className="mb-3 rounded border border-gray-200 bg-white overflow-hidden">
                          <div className="px-3 py-1.5 bg-gray-50 text-[11px] font-bold uppercase text-gray-400 flex items-center justify-between">
                            <span>Source Integrity Check</span>
                            {m.cross_file_ok && m.amount_status === "match" ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">ALL CONSISTENT</span>
                            ) : !m.cross_file_ok ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">FILE INCONSISTENCY</span>
                            ) : null}
                          </div>
                          <table className="w-full text-[12px]">
                            <thead><tr className="border-b border-gray-100">
                              <th className="text-left px-3 py-1.5 text-[10px] font-bold uppercase text-gray-400">Source</th>
                              <th className="text-left px-3 py-1.5 text-[10px] font-bold uppercase text-gray-400">Type</th>
                              <th className="text-right px-3 py-1.5 text-[10px] font-bold uppercase text-gray-400">Total (100%)</th>
                              <th className="text-center px-3 py-1.5 text-[10px] font-bold uppercase text-gray-400">vs DB</th>
                            </tr></thead>
                            <tbody>
                              {/* DB row */}
                              <tr className="border-b border-gray-50 bg-blue-50/30">
                                <td className="px-3 py-1.5 font-bold text-blue-700">Database</td>
                                <td className="px-3 py-1.5 text-gray-500">claims table</td>
                                <td className="px-3 py-1.5 text-right font-bold">{fmt(m.total_krw)}</td>
                                <td className="px-3 py-1.5 text-center text-[10px] font-bold text-gray-400">BASE</td>
                              </tr>
                              {/* File extractions */}
                              {m.extractions.map((e, i) => {
                                const diff = (e.total_100 || 0) - m.total_krw;
                                const ok = Math.abs(diff) <= 100;
                                return (
                                  <tr key={i} className="border-b border-gray-50">
                                    <td className="px-3 py-1.5 font-medium text-black">{e.file.length > 35 ? e.file.slice(0, 35) + "..." : e.file}</td>
                                    <td className="px-3 py-1.5">
                                      <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        e.type === "xlsx" ? "bg-green-50 text-green-700" : e.type === "pdf" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                                      }`}>{e.type}</span>
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-bold">{e.currency} {fmt(e.total_100)}</td>
                                    <td className="px-3 py-1.5 text-center">
                                      {ok ? (
                                        <span className="text-[10px] font-bold text-emerald-600">OK</span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-red-600">{fmt(diff)}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {m.extractions.length === 0 && (
                        <div className="mb-3 px-3 py-2 rounded border border-amber-200 bg-amber-50 text-[12px] text-amber-700 font-medium flex items-center justify-between">
                          <span>No amounts extracted (xlsx not available or no data)</span>
                          {m.files.some((f: {type: string}) => f.type === "pdf") && (
                            <button onClick={async (e) => {
                              const btn = e.currentTarget;
                              btn.textContent = "Extracting...";
                              btn.disabled = true;
                              try {
                                const pdfFile = m.files.find((f: {type: string}) => f.type === "pdf");
                                if (!pdfFile) return;
                                const res = await fetch(`${API_URL}/api/audit-data/extract-file?path=${encodeURIComponent(pdfFile.path)}`, { method: "POST" });
                                const data = await res.json();
                                if (data && data.total_100 != null) {
                                  alert(`Extracted: ${data.currency || ""} ${(data.total_100 as number).toLocaleString()}\n${data.summary || ""}`);
                                  runClaimAudit();
                                } else {
                                  alert("No amounts found in this file");
                                }
                              } catch (err) {
                                alert("Extraction failed: " + err);
                              } finally {
                                btn.textContent = "Extract with AI";
                                btn.disabled = false;
                              }
                            }} className="px-2 py-1 rounded text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                              Extract with AI
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2 mb-2 text-[11px]">
                        <span className="text-gray-400">Reinsurers:</span>
                        {m.reinsurers.map((r) => (
                          <span key={r} className="px-1.5 py-0.5 rounded bg-gray-100 text-black border border-gray-200 font-medium">{r}</span>
                        ))}
                      </div>
                      <div className="space-y-1">
                        {m.files.map((f, i) => {
                          const fileUrl = `${API_URL}/files/${encodeURI(f.path)}`;
                          const fileKey = `${m.ref_no}-${i}`;
                          const isPreviewing = previewFile === fileKey;
                          const canPreview = f.type === "pdf" || f.type === "msg";

                          return (
                            <div key={i} className="bg-white rounded border border-gray-100 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    f.type === "pdf" ? "bg-red-50 text-red-700" : f.type === "xlsx" ? "bg-green-50 text-green-700" : f.type === "msg" ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"
                                  }`}>{f.type}</span>
                                  <span className="text-[12px] font-medium text-black">{f.name}</span>
                                </div>
                                <div className="flex gap-2">
                                  {canPreview && (
                                    <button onClick={async () => {
                                      if (isPreviewing) { setPreviewFile(null); setMsgContent(null); return; }
                                      setPreviewFile(fileKey);
                                      if (f.type === "msg") {
                                        const res = await fetchApi<Record<string, unknown>>(`/api/audit-data/preview-msg?path=${encodeURIComponent(f.path)}`);
                                        setMsgContent(res);
                                      }
                                    }} className="text-[11px] font-bold text-violet-600">
                                      {isPreviewing ? "Close" : "Preview"}
                                    </button>
                                  )}
                                  {(f.type === "pdf" || f.type === "xlsx") && (
                                    <button onClick={async () => {
                                      const res = await fetchApi<Record<string, unknown>>(`/api/audit-data/extract-file?path=${encodeURIComponent(f.path)}`, { method: "POST" });
                                      if (res && res.total_100 != null) {
                                        alert(`Extracted: ${res.currency} ${(res.total_100 as number).toLocaleString()}`);
                                        runClaimAudit();
                                      } else {
                                        alert("No amounts found");
                                      }
                                    }} className="text-[11px] font-bold text-emerald-600">Extract</button>
                                  )}
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-blue-600">Open</a>
                                </div>
                              </div>
                              {isPreviewing && f.type === "pdf" && (
                                <iframe src={fileUrl} className="w-full border-t border-gray-200" style={{ height: 400 }} />
                              )}
                              {isPreviewing && f.type === "msg" && msgContent && (
                                <div className="border-t border-gray-200 bg-gray-50 p-3 text-[12px]">
                                  {msgContent.error ? (
                                    <span className="text-red-500">{msgContent.error as string}</span>
                                  ) : (
                                    <div>
                                      <div className="space-y-1 mb-3 pb-3 border-b border-gray-200">
                                        {!!msgContent.subject && <div><span className="font-bold text-gray-400 w-16 inline-block">Subject:</span> <span className="font-bold text-black">{msgContent.subject as string}</span></div>}
                                        {!!msgContent.sender && <div><span className="font-bold text-gray-400 w-16 inline-block">From:</span> {msgContent.sender as string}</div>}
                                        {!!msgContent.to && <div><span className="font-bold text-gray-400 w-16 inline-block">To:</span> {msgContent.to as string}</div>}
                                        {!!msgContent.date && <div><span className="font-bold text-gray-400 w-16 inline-block">Date:</span> {msgContent.date as string}</div>}
                                      </div>
                                      <pre className="whitespace-pre-wrap text-[12px] text-black font-sans">{msgContent.body as string}</pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* No file */}
          {claimTab === "no_file" && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase text-gray-400">Ref No.</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase text-gray-400">Account</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase text-gray-400">Reinsurers</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase text-gray-400">Claims</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase text-gray-400">KRW</th>
                  </tr>
                </thead>
                <tbody>
                  {claimResult.no_file_details.map((nf) => (
                    <tr key={nf.ref_no} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-bold text-black">{nf.ref_no}</td>
                      <td className="px-3 py-2.5">{nf.account_name}</td>
                      <td className="px-3 py-2.5 text-[11px] text-gray-500">{nf.reinsurers.join(", ")}</td>
                      <td className="px-3 py-2.5 text-right">{nf.claim_count}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{fmt(nf.total_krw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Orphan files */}
          {claimTab === "orphan" && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase text-gray-400">Ref No.</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase text-gray-400">Company</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase text-gray-400">Type</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase text-gray-400">Date</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase text-gray-400">Files</th>
                  </tr>
                </thead>
                <tbody>
                  {claimResult.orphan_file_details.map((o) => (
                    <tr key={o.ref_no} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-bold text-black">{o.ref_no}</td>
                      <td className="px-3 py-2.5">{o.company}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{o.claim_type}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{o.date}</td>
                      <td className="px-3 py-2.5 text-right">{o.file_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Premium Audit - keep existing */}
      {mode === "premium" && premiumResult && !loading && (
        <>
          <div className="grid grid-cols-5 gap-3 mb-5">
            <StatCard title="STMT Files" value={premiumResult.total_files as number} />
            <StatCard title="Matched" value={premiumResult.matches as number} accent="text-emerald-600" />
            <StatCard title="Mismatches" value={premiumResult.mismatches as number} accent={(premiumResult.mismatches as number) > 0 ? "text-red-600" : "text-emerald-600"} />
            <StatCard title="Not in DB" value={premiumResult.not_found_in_db as number} accent={(premiumResult.not_found_in_db as number) > 0 ? "text-amber-600" : undefined} />
            <StatCard title="Parse Errors" value={premiumResult.parse_errors as number} />
          </div>
          <div className="text-[12px] text-gray-400">
            Mismatches: {(premiumResult.mismatch_details as unknown[])?.length || 0} details.
            Expand premium audit view for full results.
          </div>
        </>
      )}

      {!claimResult && !premiumResult && !loading && (
        <div className="text-center py-16 border border-gray-200 rounded-lg bg-white">
          <p className="text-[14px] font-bold text-black mb-2">Click "Run Audit" to start</p>
          <p className="text-[12px] text-gray-400">Compares DB claim records with actual PLA/SOC files in 2026년 3월 folder</p>
        </div>
      )}
    </div>
  );
}
