"use client";

/**
 * Admin → Slip Testbench → Runs → [id]
 *
 * One persisted run, broken out into:
 *   - summary header (overall accuracy, severity counts, by-doc bars)
 *   - per-pair cards: 3-way PDF iframes (input / GT / generated)
 *     + diff table + VLM analysis per non-match row
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

interface SeverityCounts {
  match: number;
  minor: number;
  major: number;
  missing: number;
}

interface RunSummary {
  pairs: number;
  compared_pairs: number;
  weighted_accuracy: number | null;
  severity_counts: SeverityCounts;
  by_doc_type: Record<
    string,
    { pairs: number; weighted_accuracy: number | null; severity: SeverityCounts }
  >;
  by_cause?: Record<string, number>;
}

interface PairSummary {
  id: string;
  doc_type: string;
  pair_key: string;
  ref_no: string | null;
  reinsurer: string | null;
  status: string;
  accuracy: number | null;
  input_filename: string | null;
  gt_filename: string | null;
  gen_filename: string | null;
}

interface RunDetail {
  id: string;
  label: string | null;
  dataset_path: string;
  status: string;
  doc_types: string[] | null;
  summary: RunSummary | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
  pairs: PairSummary[];
}

interface FieldDiff {
  label: string;
  key: string;
  original: string;
  generated: string;
  severity: "match" | "minor" | "major" | "missing";
  note: string | null;
}

interface VlmEntry {
  cause: string;
  winner: string;
  evidence: string;
  suggested_fix: string;
  confidence: number;
  note?: string;
  error?: string;
}

interface PairDetail extends PairSummary {
  input_extracted: Record<string, unknown> | null;
  gt_extracted: Record<string, unknown> | null;
  gen_extracted: Record<string, unknown> | null;
  diffs: FieldDiff[] | null;
  vlm_analysis: Record<string, VlmEntry> | null;
  error_message: string | null;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  pla: "PLA",
  soc: "SOC",
  pla_bordereau: "PLA Bordereau",
  soc_bordereau: "SOC Bordereau",
};

const CAUSE_LABEL: Record<string, string> = {
  ocr_miss: "OCR Miss",
  prompt_gap: "Prompt Gap",
  rule_mismatch: "Rule Mismatch",
  input_ambiguous: "Input Ambiguous",
  gt_error: "GT Error",
  ok_equivalent: "Equivalent",
  unknown: "Unknown",
};

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/slip-testbench/runs/${runId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
        return r.json();
      })
      .then((d) => setRun(d as RunDetail))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [runId]);

  if (error) {
    return (
      <div className="p-8 text-[12px] text-rose-700">
        <Link href="/ins/admin/slip-testbench/runs" className="underline">
          ← Runs
        </Link>
        <div className="mt-4">Failed to load: {error}</div>
      </div>
    );
  }
  if (!run) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-[10px] uppercase tracking-[0.3em] text-slate-400">
        Loading
      </div>
    );
  }

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      <div className="border-b border-slate-900 px-6 py-4 bg-slate-900 text-white">
        <Link
          href="/ins/admin/slip-testbench/runs"
          className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-white"
        >
          ← Runs
        </Link>
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-300 mt-2">
          Admin · Slip Testbench · Run Detail
        </div>
        <div className="text-[18px] font-bold mt-1">
          {run.label || fmtTime(run.created_at)}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
          {fmtTime(run.created_at)} → {fmtTime(run.finished_at)} ·{" "}
          {run.dataset_path}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {run.status === "error" && (
          <div className="border border-rose-300 bg-rose-50 px-4 py-3 text-[11px] text-rose-700">
            <span className="font-bold uppercase tracking-wider">Error · </span>
            {run.error_message}
          </div>
        )}

        {run.summary && <SummaryHeader summary={run.summary} />}

        <div className="space-y-4">
          {run.pairs.length === 0 ? (
            <div className="border border-slate-200 bg-white px-4 py-12 text-center text-[11px] text-slate-400">
              데이터셋에서 페어를 찾지 못했습니다.
            </div>
          ) : (
            run.pairs.map((p) => <PairCard key={p.id} runId={runId} pair={p} />)
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryHeader({ summary }: { summary: RunSummary }) {
  const total =
    summary.severity_counts.match +
    summary.severity_counts.minor +
    summary.severity_counts.major +
    summary.severity_counts.missing;
  return (
    <div className="grid grid-cols-4 gap-px bg-slate-200 border border-slate-200">
      <Kpi
        label="Weighted Accuracy"
        sub="가중 정확도"
        value={fmtPct(summary.weighted_accuracy)}
        accent={
          summary.weighted_accuracy != null && summary.weighted_accuracy >= 0.85
            ? "text-emerald-700"
            : summary.weighted_accuracy != null && summary.weighted_accuracy < 0.6
            ? "text-[#b91c1c]"
            : "text-slate-900"
        }
      />
      <Kpi
        label="Pairs"
        sub="총 페어"
        value={`${summary.compared_pairs} / ${summary.pairs}`}
        hint="GT+Gen 모두 있는 / 전체"
      />
      <SeverityKpi counts={summary.severity_counts} total={total} />
      <CauseKpi causes={summary.by_cause ?? {}} />
    </div>
  );
}

function Kpi({
  label,
  sub,
  value,
  hint,
  accent,
}: {
  label: string;
  sub: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
        {label}
      </div>
      <div className="text-[10px] text-slate-400">{sub}</div>
      <div
        className={`text-[32px] font-bold tabular-nums mt-1 ${
          accent ?? "text-slate-900"
        }`}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{hint}</div>
      )}
    </div>
  );
}

function SeverityKpi({
  counts,
  total,
}: {
  counts: SeverityCounts;
  total: number;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
        Severity
      </div>
      <div className="text-[10px] text-slate-400">필드 단위 분포</div>
      <div className="mt-2 space-y-1">
        <SeverityRow label="match" n={counts.match} total={total} color="bg-emerald-500" />
        <SeverityRow label="minor" n={counts.minor} total={total} color="bg-amber-500" />
        <SeverityRow label="major" n={counts.major} total={total} color="bg-rose-500" />
        <SeverityRow label="missing" n={counts.missing} total={total} color="bg-slate-400" />
      </div>
    </div>
  );
}

function SeverityRow({
  label,
  n,
  total,
  color,
}: {
  label: string;
  n: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-12 uppercase tracking-wider text-slate-600 font-bold">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-mono tabular-nums text-slate-700">
        {n}
      </span>
    </div>
  );
}

function CauseKpi({ causes }: { causes: Record<string, number> }) {
  const entries = Object.entries(causes).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
        VLM Cause
      </div>
      <div className="text-[10px] text-slate-400">불일치 원인 집계</div>
      {entries.length === 0 ? (
        <div className="text-[11px] text-slate-400 mt-3">분석 대상 없음</div>
      ) : (
        <ul className="mt-2 space-y-0.5 text-[10px]">
          {entries.slice(0, 6).map(([cause, n]) => (
            <li key={cause} className="flex items-center justify-between">
              <span className="text-slate-700">{CAUSE_LABEL[cause] ?? cause}</span>
              <span className="font-mono tabular-nums text-slate-900 font-bold">
                {n}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PairCard({ runId, pair }: { runId: string; pair: PairSummary }) {
  const [open, setOpen] = useState(true);
  const [detail, setDetail] = useState<PairDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (detail) return;
    fetch(`${API_URL}/api/admin/slip-testbench/runs/${runId}/pairs/${pair.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setDetail(d as PairDetail))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [open, runId, pair.id, detail]);

  return (
    <div className="border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left"
      >
        <span className="text-[10px] font-mono text-slate-400">
          {open ? "▼" : "▶"}
        </span>
        <span className="text-[9px] uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5">
          {DOC_TYPE_LABEL[pair.doc_type] ?? pair.doc_type}
        </span>
        <span className="text-[12px] font-bold text-slate-900 font-mono">
          {pair.ref_no || pair.pair_key}
        </span>
        {pair.reinsurer && (
          <span className="text-[10px] text-slate-500">{pair.reinsurer}</span>
        )}
        <span className="text-[10px] font-mono ml-auto text-slate-700">
          {fmtPct(pair.accuracy)}
        </span>
        <span
          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 ${
            pair.status === "ok"
              ? "bg-emerald-100 text-emerald-800"
              : pair.status === "gen_missing"
              ? "bg-amber-100 text-amber-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {pair.status}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {err && (
            <div className="px-4 py-2 bg-rose-50 text-rose-700 text-[11px]">
              {err}
            </div>
          )}
          {!detail && !err && (
            <div className="px-4 py-6 text-center text-[10px] text-slate-400">
              Loading…
            </div>
          )}
          {detail && (
            <>
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50">
                {(["input", "ground_truth", "generated"] as const).map((src) => (
                  <PdfFrame
                    key={src}
                    label={src}
                    filename={
                      src === "input"
                        ? detail.input_filename
                        : src === "ground_truth"
                        ? detail.gt_filename
                        : detail.gen_filename
                    }
                    url={`${API_URL}/api/admin/slip-testbench/runs/${runId}/pairs/${pair.id}/file/${src}`}
                  />
                ))}
              </div>

              {detail.diffs && detail.diffs.length > 0 ? (
                <DiffTable diffs={detail.diffs} vlm={detail.vlm_analysis ?? {}} />
              ) : (
                <div className="px-4 py-6 text-center text-[11px] text-slate-400">
                  {detail.status === "gen_missing"
                    ? "Generated 파일 없음 — 추출 결과만 확인 가능"
                    : "비교 결과 없음"}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PdfFrame({
  label,
  filename,
  url,
}: {
  label: string;
  filename: string | null;
  url: string;
}) {
  if (!filename) {
    return (
      <div className="border border-slate-300 bg-white">
        <div className="px-2 py-1 bg-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-700">
          {label}
        </div>
        <div className="h-[500px] grid place-items-center text-[10px] text-slate-400">
          (없음)
        </div>
      </div>
    );
  }
  return (
    <div className="border border-slate-300 bg-white">
      <div className="px-2 py-1 bg-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-700 truncate">
        {label} · <span className="text-slate-500 normal-case">{filename}</span>
      </div>
      <iframe src={url} className="w-full h-[500px] border-0" title={label} />
    </div>
  );
}

function DiffTable({
  diffs,
  vlm,
}: {
  diffs: FieldDiff[];
  vlm: Record<string, VlmEntry>;
}) {
  return (
    <table className="w-full text-[11px]">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr className="text-[9px] uppercase tracking-wider text-slate-500">
          <th className="text-left px-3 py-2 font-bold w-28">Field</th>
          <th className="text-left px-3 py-2 font-bold">Ground Truth</th>
          <th className="text-left px-3 py-2 font-bold">Generated</th>
          <th className="text-left px-3 py-2 font-bold w-24">Diff</th>
          <th className="text-left px-3 py-2 font-bold w-72">VLM 분석</th>
        </tr>
      </thead>
      <tbody>
        {diffs.map((d) => (
          <DiffRow key={d.key} diff={d} vlm={vlm[d.key]} />
        ))}
      </tbody>
    </table>
  );
}

function DiffRow({ diff, vlm }: { diff: FieldDiff; vlm: VlmEntry | undefined }) {
  const cls =
    diff.severity === "match"
      ? ""
      : diff.severity === "minor"
      ? "bg-amber-50"
      : diff.severity === "missing"
      ? "bg-slate-50 text-slate-500"
      : "bg-rose-50";
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="px-3 py-2 align-top font-bold text-slate-700">{diff.label}</td>
      <td className={`px-3 py-2 align-top whitespace-pre-wrap break-words ${cls}`}>
        {diff.original || <span className="text-slate-300">—</span>}
      </td>
      <td className={`px-3 py-2 align-top whitespace-pre-wrap break-words ${cls}`}>
        {diff.generated || <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 align-top">
        <SeverityBadge severity={diff.severity} note={diff.note} />
      </td>
      <td className="px-3 py-2 align-top">
        {vlm ? <VlmCell entry={vlm} /> : (
          <span className="text-[10px] text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

function SeverityBadge({
  severity,
  note,
}: {
  severity: FieldDiff["severity"];
  note: string | null;
}) {
  const styles: Record<string, string> = {
    match: "bg-emerald-100 text-emerald-800",
    minor: "bg-amber-100 text-amber-800",
    major: "bg-rose-100 text-rose-800",
    missing: "bg-slate-100 text-slate-600",
  };
  return (
    <div>
      <span
        className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${styles[severity]}`}
      >
        {severity === "major" ? "diff" : severity}
      </span>
      {note && <div className="text-[9px] text-slate-500 mt-0.5">{note}</div>}
    </div>
  );
}

function VlmCell({ entry }: { entry: VlmEntry }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px bg-slate-900 text-white">
          {CAUSE_LABEL[entry.cause] ?? entry.cause}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-500">
          {entry.winner}
        </span>
        <span className="text-[9px] font-mono text-slate-500 ml-auto">
          {(entry.confidence * 100).toFixed(0)}%
        </span>
      </div>
      {entry.evidence && (
        <div className="text-[10px] text-slate-700">
          <span className="font-bold text-slate-500 uppercase tracking-wider mr-1 text-[9px]">
            근거
          </span>
          {entry.evidence}
        </div>
      )}
      {entry.suggested_fix && (
        <div className="text-[10px] text-slate-600">
          <span className="font-bold text-slate-500 uppercase tracking-wider mr-1 text-[9px]">
            제안
          </span>
          {entry.suggested_fix}
        </div>
      )}
      {entry.error && (
        <div className="text-[10px] text-rose-700">err: {entry.error}</div>
      )}
    </div>
  );
}
