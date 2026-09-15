"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchApi } from "@/lib/api";
import StatCard from "@/components/StatCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

interface Document {
  id: number;
  policy_id: number;
  doc_type: string | null;
  file_name: string;
  file_path: string;
  cover_note_no: string | null;
  assured: string | null;
}

interface DocumentList {
  items: Document[];
  total: number;
  page: number;
  page_size: number;
}

interface ParseStatus {
  total: number;
  parsed: number;
  success: number;
  failed: number;
  remaining: number;
  progress_pct: number;
}

interface DocumentStats {
  total: number;
  by_type: { type: string; count: number }[];
  by_policy: { cover_note: string; assured: string; count: number }[];
}

const TYPE_COLORS: Record<string, string> = {
  closing: "bg-blue-50 text-blue-700 border-blue-200",
  stmt: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cd_note: "bg-violet-50 text-violet-700 border-violet-200",
  slip: "bg-amber-50 text-amber-700 border-amber-200",
  signed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  endorsement: "bg-orange-50 text-orange-700 border-orange-200",
  email: "bg-gray-100 text-gray-600 border-gray-200",
  pdf: "bg-red-50 text-red-700 border-red-200",
  document: "bg-blue-50 text-blue-600 border-blue-200",
  spreadsheet: "bg-green-50 text-green-700 border-green-200",
  cover_page: "bg-pink-50 text-pink-700 border-pink-200",
  invoice: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

export default function DocumentsPage() {
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [data, setData] = useState<DocumentList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [docType, setDocType] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ total_files: number; matched_files: number; unmatched_files: number; unmatched_deals: string[] } | null>(null);
  const [parseStatus, setParseStatus] = useState<ParseStatus | null>(null);
  const [parsing, setParsing] = useState(false);

  const loadStats = useCallback(() => {
    fetchApi<DocumentStats>("/api/documents/stats").then(setStats);
  }, []);

  const loadDocs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (search) params.set("search", search);
    if (docType) params.set("doc_type", docType);
    fetchApi<DocumentList>(`/api/documents?${params}`)
      .then(setData).finally(() => setLoading(false));
  }, [page, search, docType]);

  const loadParseStatus = useCallback(() => {
    fetchApi<ParseStatus>("/api/documents/parse-status").then(setParseStatus);
  }, []);

  useEffect(() => { loadStats(); loadParseStatus(); }, [loadStats, loadParseStatus]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleScan = async () => {
    setScanning(true);
    const res = await fetchApi<{ total_files: number; matched_files: number; unmatched_files: number; unmatched_deals: string[] }>("/api/policies/scan-files", { method: "POST" });
    setScanResult(res);
    setScanning(false);
    loadStats();
    loadDocs();
  };

  const handleParse = async () => {
    setParsing(true);
    await fetchApi("/api/documents/parse-all", { method: "POST" });
    setParsing(false);
    // Poll status
    const poll = setInterval(async () => {
      const s = await fetchApi<ParseStatus>("/api/documents/parse-status");
      setParseStatus(s);
      if (s.remaining === 0) {
        clearInterval(poll);
        loadDocs();
      }
    }, 5000);
  };

  const totalPages = data ? Math.ceil(data.total / 50) : 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-black">Documents</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Files from Actual data folder matched to policies</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          <StatCard title="Total Documents" value={stats.total} accent="text-blue-600" />
          <StatCard title="Document Types" value={stats.by_type.length} />
          <StatCard title="Policies with Docs" value={stats.by_policy.length} />
          <StatCard title="Top Policy" value={stats.by_policy[0]?.count || 0} subtitle={stats.by_policy[0]?.assured || ""} />
        </div>
      )}

      {/* Type breakdown */}
      {stats && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button onClick={() => { setDocType(""); setPage(1); }}
            className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${!docType ? "bg-blue-600 text-white border-blue-600" : "bg-white text-black border-gray-200 hover:bg-gray-50"}`}>
            All ({stats.total})
          </button>
          {stats.by_type.map((t) => (
            <button key={t.type} onClick={() => { setDocType(t.type); setPage(1); }}
              className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${docType === t.type ? "bg-blue-600 text-white border-blue-600" : `${TYPE_COLORS[t.type] || "bg-gray-50 text-gray-600 border-gray-200"} hover:opacity-80`}`}>
              {t.type} ({t.count})
            </button>
          ))}
        </div>
      )}

      {/* Scan result */}
      {scanResult && (
        <div className={`rounded-lg border p-3 mb-4 ${scanResult.unmatched_files > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className="flex items-center gap-4 text-[13px]">
            <span className="font-bold text-black">Scan Result</span>
            <span className="font-bold text-emerald-700">{scanResult.matched_files} matched</span>
            <span className="text-gray-400">/</span>
            <span className="font-medium">{scanResult.total_files} total</span>
            <span className="text-[12px] text-gray-400">({(scanResult.matched_files / scanResult.total_files * 100).toFixed(1)}%)</span>
            {scanResult.unmatched_deals.length > 0 && (
              <span className="text-amber-700 font-medium">{scanResult.unmatched_deals.length} unmatched deals</span>
            )}
          </div>
        </div>
      )}

      {/* Parse progress */}
      {parseStatus && parseStatus.total > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 mb-4">
          <div className="flex items-center justify-between text-[12px] mb-2">
            <span className="font-bold text-black">Document Parsing</span>
            <div className="flex gap-3">
              <span className="text-emerald-600 font-bold">{parseStatus.success} parsed</span>
              {parseStatus.failed > 0 && <span className="text-red-600 font-bold">{parseStatus.failed} failed</span>}
              <span className="text-gray-400">{parseStatus.remaining} remaining</span>
              <span className="font-bold text-black">{parseStatus.progress_pct}%</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${parseStatus.progress_pct}%` }} />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex gap-2">
          <input type="text" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            placeholder="Search file name or assured..."
            className="px-3 py-1.5 border border-gray-200 rounded-md text-[13px] w-64 focus:outline-none focus:border-blue-500" />
          <button onClick={() => { setSearch(searchInput); setPage(1); }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-[13px] font-semibold hover:bg-blue-700">Search</button>
        </div>
        <button onClick={handleScan} disabled={scanning}
          className="px-3 py-1.5 border border-violet-600 text-violet-600 rounded-md text-[12px] font-bold hover:bg-violet-50 disabled:opacity-50">
          {scanning ? "Scanning..." : "Re-scan Files"}
        </button>
        <button onClick={handleParse} disabled={parsing || (parseStatus?.remaining === 0)}
          className="px-3 py-1.5 border border-emerald-600 text-emerald-600 rounded-md text-[12px] font-bold hover:bg-emerald-50 disabled:opacity-50">
          {parsing ? "Parsing..." : `Parse Documents${parseStatus ? ` (${parseStatus.remaining} left)` : ""}`}
        </button>
        <span className="ml-auto text-[12px] font-semibold text-gray-400">{data?.total || 0} documents</span>
      </div>

      {/* Table */}
      {(!stats || stats.total === 0) && !loading ? (
        <div className="text-center py-16 border border-gray-200 rounded-lg bg-white">
          <p className="text-[14px] font-bold text-black mb-2">No documents scanned</p>
          <p className="text-[12px] text-gray-400 mb-4">Scan the Actual data folder to match files to policies</p>
          <button onClick={handleScan} disabled={scanning}
            className="px-4 py-2 bg-violet-600 text-white rounded-md text-[13px] font-bold hover:bg-violet-700 disabled:opacity-50">
            {scanning ? "Scanning..." : "Scan Files"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Type</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">File Name</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Policy</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Assured</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Extracted</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 w-16">Open</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((d) => {
                const color = TYPE_COLORS[d.doc_type || ""] || "bg-gray-50 text-gray-600 border-gray-200";
                const fileUrl = `${API_URL}/files/${encodeURI(d.file_path)}`;
                return (
                  <tr key={d.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${color}`}>{d.doc_type || "other"}</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-black">{d.file_name}</td>
                    <td className="px-3 py-2.5">
                      <a href={`/ins/policies/${d.policy_id}`} className="text-blue-600 font-bold hover:text-blue-800 text-[12px]">{d.cover_note_no}</a>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{d.assured || "-"}</td>
                    <td className="px-3 py-2.5 text-[11px]">
                      {d.extracted_data && d.extracted_data._status === "parsed" ? (
                        <span className="text-emerald-600 font-medium" title={d.extracted_data.summary || ""}>
                          {d.extracted_data.summary ? d.extracted_data.summary.slice(0, 40) + (d.extracted_data.summary.length > 40 ? "..." : "") : "OK"}
                        </span>
                      ) : d.extracted_data && d.extracted_data._status === "unparsable" ? (
                        <span className="text-gray-400">N/A</span>
                      ) : d.extracted_data && d.extracted_data._status === "extract_failed" ? (
                        <span className="text-red-400">Failed</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800">View</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
