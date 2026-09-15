"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchApi } from "@/lib/api";

const HIDDEN_ROUTES = ["/ins/tools/slip-generator"];

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  url: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  contract: { label: "Contract", color: "bg-blue-50 text-blue-700 border-blue-200" },
  claim: { label: "Claim", color: "bg-amber-50 text-amber-700 border-amber-200" },
  cover_note: { label: "Cover Note", color: "bg-violet-50 text-violet-700 border-violet-200" },
};

export default function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetchApi<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(res.results);
      setOpen(true);
      setSelectedIdx(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 200);
  };

  const navigate = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(result.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedIdx >= 0) {
      e.preventDefault();
      navigate(results[selectedIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (HIDDEN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search...    Cmd+K"
          className="w-full px-3 py-1.5 pl-8 border border-slate-200 rounded text-[12px] font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50"
        />
        <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {loading && (
          <div className="absolute right-2.5 top-2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((r, idx) => {
            const typeInfo = TYPE_LABELS[r.type] || { label: r.type, color: "bg-gray-50 text-gray-600 border-gray-200" };
            return (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => navigate(r)}
                className={`px-3 py-2 cursor-pointer border-b border-gray-50 last:border-0 flex items-center gap-3 ${
                  idx === selectedIdx ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${typeInfo.color}`}>
                  {typeInfo.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-black truncate">{r.title}</div>
                  <div className="text-[11px] text-gray-400 truncate">{r.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && query && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 px-3 py-4 text-center text-[13px] text-gray-400">
          No results for "{query}"
        </div>
      )}
    </div>
  );
}
