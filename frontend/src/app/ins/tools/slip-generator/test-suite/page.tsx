"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

interface Case {
  id: string;
  path: string;
  name: string;
  expected_reinsurers: string[];
  expected_ref_no: string | null;
  input_files: string[];
  answer_files: string[];
}

interface RunResult {
  case_id: string;
  status?: "running" | "done";
  pass?: boolean;
  error?: string;
  elapsed?: number;
  started_at?: number;
  expected?: {
    expected_reinsurers: string[];
    expected_ref_no: string | null;
    input_files: string[];
    answer_files: string[];
  };
  actual?: {
    reinsurers: string[];
    ref_no: string | null;
    extracted: Record<string, unknown>;
    socs: { reinsurer: string; share: number; amount: number; amount_fmt: string }[];
    policy: { cover_note_no: string; assured: string; score: number } | null;
    thinking: string[];
  };
  compare?: {
    matched: string[];
    missing: string[];
    extra: string[];
    refno_ok: boolean;
  };
}

export default function TestSuitePage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [runAllInProgress, setRunAllInProgress] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pass" | "fail" | "pending">("all");

  useEffect(() => {
    fetch(`${API_URL}/api/tools/soc/test-suite/cases`)
      .then((r) => r.json())
      .then((data) => setCases(data || []))
      .catch((e) => console.error(e));
  }, []);

  // Poll server-side results every 2s so external runs (CLI) show up live
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${API_URL}/api/tools/soc/test-suite/results`);
        const data = await res.json();
        if (cancelled) return;
        const serverResults: Record<string, RunResult> = data.results || {};
        setResults((prev) => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(serverResults)) merged[k] = v;
          return merged;
        });
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const runOne = async (c: Case) => {
    setRunning((r) => ({ ...r, [c.id]: true }));
    try {
      const res = await fetch(`${API_URL}/api/tools/soc/test-suite/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: c.id }),
      });
      const data: RunResult = await res.json();
      setResults((r) => ({ ...r, [c.id]: data }));
    } catch (e) {
      setResults((r) => ({ ...r, [c.id]: { case_id: c.id, error: String(e) } }));
    } finally {
      setRunning((r) => ({ ...r, [c.id]: false }));
    }
  };

  const runAll = async () => {
    setRunAllInProgress(true);
    const CONCURRENCY = 3;
    const queue = [...cases];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const c = queue.shift();
        if (!c) break;
        await runOne(c);
      }
    });
    await Promise.all(workers);
    setRunAllInProgress(false);
  };

  const done = Object.values(results).filter((r) => r.status === "done");
  const runningCt = Object.values(results).filter((r) => r.status === "running").length;
  const stats = {
    total: cases.length,
    pass: done.filter((r) => r.pass).length,
    fail: done.filter((r) => !r.pass && !r.error && r.compare).length,
    error: done.filter((r) => r.error).length,
    running: runningCt,
    pending: cases.length - done.length - runningCt,
  };

  const filtered = cases.filter((c) => {
    const r = results[c.id];
    if (filter === "all") return true;
    if (filter === "pending") return !r || r.status === "running";
    if (filter === "pass") return r?.pass === true;
    if (filter === "fail") return r?.status === "done" && r.pass !== true;
    return true;
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">SOC Generator — 테스트 스위트</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            reference/보험금/2026년 3월 하위 케이스별로 입력 파일 → 생성기 실행 → SOC_*.pdf 답지와 비교
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              await fetch(`${API_URL}/api/tools/soc/test-suite/results/clear`, { method: "POST" });
              setResults({});
            }}
            className="px-3 py-1.5 border border-slate-300 rounded text-[12px] font-bold text-slate-700 hover:bg-slate-50">
            결과 초기화
          </button>
          <button
            onClick={runAll}
            disabled={runAllInProgress || cases.length === 0}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-bold hover:bg-blue-700 disabled:opacity-50">
            {runAllInProgress ? "실행 중..." : `전체 실행 (${cases.length})`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-4 text-[12px]">
        {[
          { label: "총 케이스", val: stats.total, color: "text-slate-900", f: "all" as const },
          { label: "통과", val: stats.pass, color: "text-emerald-600", f: "pass" as const },
          { label: "실패", val: stats.fail, color: "text-red-600", f: "fail" as const },
          { label: "에러", val: stats.error, color: "text-amber-600", f: "fail" as const },
          { label: "실행중", val: stats.running, color: "text-blue-600", f: "pending" as const },
          { label: "대기", val: stats.pending, color: "text-slate-400", f: "pending" as const },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => setFilter(s.f)}
            className={`rounded border p-3 text-left hover:border-blue-400 ${filter === s.f ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</div>
            <div className={`text-xl font-extrabold mt-1 ${s.color}`}>{s.val}</div>
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {filtered.map((c) => {
          const r = results[c.id];
          const isRunning = running[c.id] || r?.status === "running";
          const isOpen = expanded === c.id;
          const statusColor = isRunning
            ? "bg-blue-100 text-blue-700 border-blue-300 animate-pulse"
            : r?.error
            ? "bg-amber-100 text-amber-700 border-amber-300"
            : r?.pass
            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
            : r?.status === "done"
            ? "bg-red-100 text-red-700 border-red-300"
            : "bg-slate-100 text-slate-500 border-slate-200";
          const statusLabel = isRunning ? "실행중" : r?.error ? "에러" : r?.pass ? "통과" : r?.status === "done" ? "실패" : "대기";

          return (
            <div key={c.id} className="rounded border border-slate-200 bg-white">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor} shrink-0 w-14 text-center`}>
                    {statusLabel}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0 w-12">{c.path.split("/")[0]}</span>
                  <span className="text-[12px] font-bold text-slate-900 truncate">{c.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    입력 {c.input_files.length} · 답 {c.answer_files.length}
                  </span>
                  <span className="text-[10px] text-blue-500 truncate">
                    기대: {c.expected_reinsurers.join(", ")}
                  </span>
                  {r?.compare && (
                    <span className="text-[10px] shrink-0">
                      <span className="text-emerald-600">✓{r.compare.matched.length}</span>{" "}
                      <span className="text-red-500">✗{r.compare.missing.length}</span>{" "}
                      <span className="text-amber-500">+{r.compare.extra.length}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runOne(c)}
                    disabled={isRunning}
                    className="text-[11px] font-bold text-blue-600 hover:underline disabled:opacity-50">
                    {isRunning ? "..." : r ? "재실행" : "실행"}
                  </button>
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="text-[11px] font-bold text-slate-500 hover:underline">
                    {isOpen ? "닫기" : "상세"}
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-slate-100 px-3 py-2 text-[11px] space-y-2 bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-500">경로:</span>{" "}
                    <span className="font-mono text-slate-700">{c.path}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">입력 파일:</span>
                    <ul className="list-disc ml-5 text-slate-600">
                      {c.input_files.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">답지 (기대):</span>
                    <ul className="list-disc ml-5 text-slate-600">
                      {c.answer_files.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  {r && !r.error && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="font-bold text-slate-500 mb-1">기대 재보험사</div>
                          <div className="flex flex-wrap gap-1">
                            {c.expected_reinsurers.map((x) => (
                              <span key={x} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{x}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-500 mb-1">실제 재보험사</div>
                          <div className="flex flex-wrap gap-1">
                            {r.actual?.reinsurers.map((x, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">{x}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {r.compare && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="font-bold text-emerald-600 mb-1">매칭 ({r.compare.matched.length})</div>
                            {r.compare.matched.map((x) => (<div key={x} className="text-emerald-700">✓ {x}</div>))}
                          </div>
                          <div>
                            <div className="font-bold text-red-600 mb-1">누락 ({r.compare.missing.length})</div>
                            {r.compare.missing.map((x) => (<div key={x} className="text-red-700">✗ {x}</div>))}
                          </div>
                          <div>
                            <div className="font-bold text-amber-600 mb-1">초과 ({r.compare.extra.length})</div>
                            {r.compare.extra.map((x) => (<div key={x} className="text-amber-700">+ {x}</div>))}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-slate-500">Ref No:</span>{" "}
                        기대 <span className="font-mono">{c.expected_ref_no || "-"}</span>{" / "}
                        실제 <span className="font-mono">{r.actual?.ref_no || "-"}</span>{" "}
                        {r.compare?.refno_ok ? <span className="text-emerald-600">✓</span> : <span className="text-red-500">✗</span>}
                      </div>
                      {r.actual?.socs && r.actual.socs.length > 0 && (
                        <div>
                          <div className="font-bold text-slate-500 mb-1">생성된 SOC</div>
                          <table className="w-full text-[11px] bg-white border border-slate-200">
                            <thead className="bg-slate-100">
                              <tr><th className="px-2 py-1 text-left">재보험사</th><th className="px-2 py-1 text-right">비율</th><th className="px-2 py-1 text-right">금액</th></tr>
                            </thead>
                            <tbody>
                              {r.actual.socs.map((s, i) => (
                                <tr key={i} className="border-t border-slate-100">
                                  <td className="px-2 py-1">{s.reinsurer}</td>
                                  <td className="px-2 py-1 text-right">{(s.share * 100).toFixed(2)}%</td>
                                  <td className="px-2 py-1 text-right">{s.amount_fmt}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {r.actual?.thinking && r.actual.thinking.length > 0 && (
                        <details>
                          <summary className="font-bold text-slate-500 cursor-pointer">AI 추론 ({r.actual.thinking.length})</summary>
                          <div className="mt-1 space-y-1 pl-3">
                            {r.actual.thinking.map((t, i) => (
                              <div key={i} className="text-slate-600">[{i + 1}] {t}</div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  )}
                  {r?.error && (
                    <div className="rounded bg-red-50 border border-red-200 p-2 text-red-700">{r.error}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
