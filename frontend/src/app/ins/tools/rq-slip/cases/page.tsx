"use client";

// RQ-slip 검수 큐. /ins/tools/rq-slip/cases — 저장된 RQ-slip 케이스를
// 한눈에 보고 검수 상태로 필터링한 뒤 클릭해서 작업 화면으로 이동한다.
//
// 작업 화면(/ins/tools/rq-slip)은 ?case=<id> 쿼리스트링으로 진입 시
// 해당 케이스를 자동 로드한다.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

interface CaseRow {
  id: string;
  insured: string | null;
  line: string | null;
  reinsured: string | null;
  status: string;
  verdict: string | null;
  edit_count: number;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type StatusFilter = "all" | "draft" | "reviewed" | "sent";
type VerdictFilter = "all" | "none" | "correct" | "needs_fix" | "wrong";

const STATUS_INK: Record<string, { bg: string; ink: string; label: string }> = {
  draft: { bg: "#e2e8f0", ink: "#334155", label: "Draft" },
  reviewed: { bg: "#bae6fd", ink: "#0c4a6e", label: "Reviewed" },
  sent: { bg: "#bbf7d0", ink: "#14532d", label: "Sent" },
};

const VERDICT_INK: Record<string, { bg: string; ink: string; label: string }> = {
  correct: { bg: "#a7f3d0", ink: "#065f46", label: "정확" },
  needs_fix: { bg: "#fde68a", ink: "#78350f", label: "수정요" },
  wrong: { bg: "#fecaca", ink: "#7f1d1d", label: "오류" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_INK[status] || { bg: "#e2e8f0", ink: "#334155", label: status };
  return (
    <span
      className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{ background: meta.bg, color: meta.ink }}
    >
      {meta.label}
    </span>
  );
}

function VerdictPill({ verdict }: { verdict: string | null }) {
  if (!verdict) {
    return (
      <span className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200">
        미검수
      </span>
    );
  }
  const meta = VERDICT_INK[verdict] || { bg: "#e2e8f0", ink: "#334155", label: verdict };
  return (
    <span
      className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{ background: meta.bg, color: meta.ink }}
    >
      {meta.label}
    </span>
  );
}

export default function RqSlipCasesPage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [query, setQuery] = useState("");

  const reload = async () => {
    setError(null);
    try {
      const r = await fetch(`${API_URL}/api/tools/rq-slip/cases`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setCases((data.cases || []) as CaseRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "케이스 목록 불러오기 실패");
      setCases([]);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    if (!cases) return [];
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (verdictFilter === "none") {
        if (c.verdict) return false;
      } else if (verdictFilter !== "all") {
        if (c.verdict !== verdictFilter) return false;
      }
      if (q) {
        const hay = [c.insured, c.line, c.reinsured].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, statusFilter, verdictFilter, query]);

  const counts = useMemo(() => {
    const out = { total: 0, draft: 0, reviewed: 0, sent: 0, edited: 0 };
    if (!cases) return out;
    out.total = cases.length;
    for (const c of cases) {
      if (c.status === "draft") out.draft += 1;
      else if (c.status === "reviewed") out.reviewed += 1;
      else if (c.status === "sent") out.sent += 1;
      if ((c.edit_count || 0) > 0) out.edited += 1;
    }
    return out;
  }, [cases]);

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      <div className="border-b border-slate-900 px-6 py-4 bg-slate-900 text-white">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-300">
          Tools · RQ Slip · Cases
        </div>
        <div className="text-[18px] font-bold mt-1">RQ-slip 검수 큐</div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          저장된 placement RQ-slip 케이스. 상태/판정으로 필터하여 검수 대상을 좁힌 뒤 클릭하여 작업 화면에서 열람·검수한다.
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "전체", value: counts.total, hint: "Total" },
            { label: "Draft", value: counts.draft, hint: "검수 전" },
            { label: "Reviewed", value: counts.reviewed, hint: "판정 완료" },
            { label: "Edited", value: counts.edited, hint: "AI 추출본 대비 수정 이력" },
          ].map((k) => (
            <div key={k.label} className="border border-slate-200 bg-white px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                {k.label}
              </div>
              <div className="text-[24px] font-bold text-slate-900 tabular-nums">{k.value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{k.hint}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              상태
            </span>
            {(["all", "draft", "reviewed", "sent"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === s
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {s === "all" ? "전체" : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              판정
            </span>
            {(
              [
                ["all", "전체"],
                ["none", "미검수"],
                ["correct", "정확"],
                ["needs_fix", "수정요"],
                ["wrong", "오류"],
              ] as [VerdictFilter, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  verdictFilter === v
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[180px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Insured / Line / Reinsured 검색…"
              className="w-full px-3 py-1.5 border border-slate-300 bg-white text-[12px] focus:outline-none focus:border-slate-900"
            />
          </div>

          <button
            onClick={reload}
            className="px-3 py-1.5 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
          >
            새로고침
          </button>
        </div>

        {error && (
          <div className="border border-[#b91c1c] bg-white px-4 py-3 text-[12px] text-[#b91c1c]">
            {error}
          </div>
        )}

        {/* Empty state */}
        {cases !== null && cases.length === 0 && !error && (
          <div className="border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">
              저장된 케이스가 없습니다
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              <Link href="/ins/tools/rq-slip" className="underline">
                RQ Slip 도구
              </Link>{" "}
              에서 추출 → 저장 후 이 큐에서 검수할 수 있습니다.
            </div>
          </div>
        )}

        {/* Filtered-but-empty */}
        {cases !== null && cases.length > 0 && filtered.length === 0 && (
          <div className="border border-slate-200 bg-white px-6 py-10 text-center text-[12px] text-slate-500">
            필터 조건에 맞는 케이스가 없습니다.
          </div>
        )}

        {/* Cases table */}
        {filtered.length > 0 && (
          <div className="border border-slate-200 bg-white overflow-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-slate-100 text-slate-600 sticky top-0">
                <tr className="text-left uppercase tracking-wider text-[9px]">
                  <th className="px-3 py-2 font-bold">상태</th>
                  <th className="px-3 py-2 font-bold">판정</th>
                  <th className="px-3 py-2 font-bold">Insured</th>
                  <th className="px-3 py-2 font-bold">Line</th>
                  <th className="px-3 py-2 font-bold">Reinsured</th>
                  <th className="px-3 py-2 font-bold tabular-nums text-right">Edits</th>
                  <th className="px-3 py-2 font-bold">검수 시각</th>
                  <th className="px-3 py-2 font-bold">최근 수정</th>
                  <th className="px-3 py-2 font-bold w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-slate-100 hover:bg-amber-50 align-top"
                  >
                    <td className="px-3 py-2">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-3 py-2">
                      <VerdictPill verdict={c.verdict} />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {c.insured || <span className="text-slate-400">(미상)</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{c.line || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{c.reinsured || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-slate-700">
                      {c.edit_count > 0 ? (
                        <span className="font-mono text-amber-700">{c.edit_count}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                      {fmtDate(c.reviewed_at)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                      {fmtDate(c.updated_at)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/ins/tools/rq-slip?case=${c.id}`}
                        className="px-2 py-1 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-black"
                      >
                        열기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
