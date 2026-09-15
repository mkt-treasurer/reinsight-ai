"use client";

/**
 * Admin → Slip Testbench
 *
 * Side-by-side comparator for hand-typed `original` slips and slip-generator
 * `generated` slips. Drop both sets of PDFs; the page auto-pairs by filename
 * tokens (insured / UY / DOL / ref / reinsurer), runs each PDF through the
 * shared extraction prompt (`/api/admin/slip-testbench/extract`), and shows
 * a per-field diff so we can see how much our rule changes shift the output
 * relative to the human-made baseline.
 *
 * Not a replacement for the slip-generator UI — purely a regression /
 * comparison tool for QA work.
 */

import { useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

type Side = "original" | "generated";

interface ExtractedFields {
  filename: string;
  account_name: string;
  reinsured: string;
  cedant: string;
  line: string;
  ref_no: string;
  dol: string;
  doc_date: string;
  title_subline: string;
  currency: string;
  total_amount: number;
  expenses_reserve: number;
  location_of_loss: string;
  nature_of_loss: string;
  particulars: string;
  policy_period: string;
  remarks: string;
  description: string;
}

interface PdfItem {
  side: Side;
  file: File;
  url: string;
  /** Extracted fields once /extract resolves; null while pending. */
  fields: ExtractedFields | null;
  error: string | null;
}

interface Pair {
  key: string;
  reinsurer: string;
  original: PdfItem;
  generated: PdfItem;
}

interface CodeTableReinsurer {
  no: number | null;
  name: string;
  code: string;
  is_foreign: boolean;
}

const HANGUL_RE = /[㄰-㆏가-힯]/;

/* ---------- filename token parsing & pairing ---------- */

function pickReinsurerFromFilename(name: string): string {
  // Slip filenames embed the reinsurer in trailing parens: "... (NH).pdf",
  // "... (Samsung Fire & Marine Insurance) (1).pdf". Capture the LAST set of
  // parens that doesn't look like a download counter "(1)" / "(2)".
  const matches = Array.from(
    name.matchAll(/\(([^()]+)\)/g),
    (m) => m[1].trim()
  );
  for (let i = matches.length - 1; i >= 0; i--) {
    const v = matches[i];
    if (!/^\d+$/.test(v) && !/^DOL\b/i.test(v)) return v;
  }
  return "";
}

function tokenize(name: string): Set<string> {
  // Strip extension + parens content + common slip prefixes; split on
  // whitespace / underscores / dashes / commas. Lowercase. Drop tiny
  // tokens. Used to score similarity between an original and a generated
  // filename — both files for the same claim share insured / UY / ref / DOL.
  const base = name
    .replace(/\.[a-z]+$/i, "")
    .replace(/\([^()]*\)/g, " ")
    .replace(/^(PLA|SOC|Bordereau)[_\s]+/i, " ")
    .replace(/[_,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
  const out = new Set<string>();
  for (const t of base.split(/\s+/)) {
    const cleaned = t.replace(/[^a-z0-9가-힯-]/g, "");
    if (cleaned.length >= 3) out.add(cleaned);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function pairFiles(originals: PdfItem[], generated: PdfItem[]): {
  pairs: Pair[];
  unmatched: PdfItem[];
} {
  // Greedy max-jaccard pairing. Each generated file claims at most one
  // original, ranked by the best filename overlap. Reinsurer label must
  // also match (case-insensitive substring) — same insured but different
  // reinsurer is NOT a pair.
  const usedOrig = new Set<number>();
  const pairs: Pair[] = [];
  const tokensOf = generated.map((g) => tokenize(g.file.name));
  const origTokens = originals.map((o) => tokenize(o.file.name));

  type Candidate = { gi: number; oi: number; score: number; ri: string };
  const candidates: Candidate[] = [];
  for (let gi = 0; gi < generated.length; gi++) {
    const gri = pickReinsurerFromFilename(generated[gi].file.name).toLowerCase();
    for (let oi = 0; oi < originals.length; oi++) {
      const ori = pickReinsurerFromFilename(originals[oi].file.name).toLowerCase();
      const riOverlap =
        gri && ori && (gri.includes(ori) || ori.includes(gri));
      if (!riOverlap) continue;
      const score = jaccard(tokensOf[gi], origTokens[oi]);
      candidates.push({ gi, oi, score, ri: gri || ori });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const claimedG = new Set<number>();
  for (const c of candidates) {
    if (c.score < 0.1) break;
    if (claimedG.has(c.gi) || usedOrig.has(c.oi)) continue;
    claimedG.add(c.gi);
    usedOrig.add(c.oi);
    pairs.push({
      key: `pair-${pairs.length + 1}`,
      reinsurer: pickReinsurerFromFilename(originals[c.oi].file.name) ||
        pickReinsurerFromFilename(generated[c.gi].file.name),
      original: originals[c.oi],
      generated: generated[c.gi],
    });
  }

  const unmatched: PdfItem[] = [];
  for (let oi = 0; oi < originals.length; oi++)
    if (!usedOrig.has(oi)) unmatched.push(originals[oi]);
  for (let gi = 0; gi < generated.length; gi++)
    if (!claimedG.has(gi)) unmatched.push(generated[gi]);
  return { pairs, unmatched };
}

/* ---------- field diff ---------- */

type DiffSeverity = "match" | "minor" | "major" | "missing";

interface FieldDiff {
  label: string;
  key: keyof ExtractedFields;
  original: string;
  generated: string;
  severity: DiffSeverity;
  note?: string;
}

const FIELDS: { label: string; key: keyof ExtractedFields }[] = [
  { label: "Insured", key: "account_name" },
  { label: "Reinsured", key: "reinsured" },
  { label: "Line", key: "line" },
  { label: "Ref No", key: "ref_no" },
  { label: "Date of Loss", key: "dol" },
  { label: "Doc Date", key: "doc_date" },
  { label: "Title Subline", key: "title_subline" },
  { label: "Policy Period", key: "policy_period" },
  { label: "Currency", key: "currency" },
  { label: "Total Amount", key: "total_amount" },
  { label: "Expenses Reserve", key: "expenses_reserve" },
  { label: "Location of Loss", key: "location_of_loss" },
  { label: "Nature of Loss", key: "nature_of_loss" },
  { label: "Particulars", key: "particulars" },
  { label: "Remarks", key: "remarks" },
];

function normForCompare(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function classifyDiff(
  field: { label: string; key: keyof ExtractedFields },
  origVal: unknown,
  genVal: unknown
): { severity: DiffSeverity; note?: string } {
  const o = String(origVal ?? "");
  const g = String(genVal ?? "");
  if (!o && !g) return { severity: "match" };
  if (o && !g) return { severity: "missing", note: "generated empty" };
  if (!o && g) return { severity: "missing", note: "original empty" };

  // Numeric fields: compare as numbers.
  if (field.key === "total_amount" || field.key === "expenses_reserve") {
    const on = Number(origVal) || 0;
    const gn = Number(genVal) || 0;
    if (on === gn) return { severity: "match" };
    const diff = Math.abs(on - gn);
    const pct = on ? diff / Math.abs(on) : 1;
    return {
      severity: pct < 0.001 ? "minor" : "major",
      note: pct < 0.001 ? "rounding" : `Δ ${diff.toLocaleString()}`,
    };
  }

  if (o === g) return { severity: "match" };
  const oN = normForCompare(o);
  const gN = normForCompare(g);
  if (oN === gN) return { severity: "minor", note: "case/whitespace" };
  // Substring containment → minor (suffix added/removed, e.g. "Co., Ltd.")
  if (oN.includes(gN) || gN.includes(oN)) {
    return { severity: "minor", note: "wrap" };
  }
  // Korean ↔ English mismatch — that's exactly the foreign-rule scenario.
  // Treat as "major" but tag so the UI knows it's expected when slip is
  // foreign.
  const oHan = HANGUL_RE.test(o);
  const gHan = HANGUL_RE.test(g);
  if (oHan !== gHan) {
    return {
      severity: "major",
      note: oHan ? "original Korean → generated English" : "original English → generated Korean",
    };
  }
  return { severity: "major" };
}

function buildDiff(orig: ExtractedFields, gen: ExtractedFields): FieldDiff[] {
  return FIELDS.map((f) => {
    const c = classifyDiff(f, orig[f.key], gen[f.key]);
    return {
      label: f.label,
      key: f.key,
      original: String(orig[f.key] ?? ""),
      generated: String(gen[f.key] ?? ""),
      severity: c.severity,
      note: c.note,
    };
  });
}

/* ---------- foreign-rule violation check ---------- */

interface RuleViolation {
  kind: "korean_in_foreign" | "all_caps" | "missing_doc_date" | "all_caps_reinsured";
  message: string;
  field?: keyof ExtractedFields;
}

function checkRuleViolations(
  side: ExtractedFields,
  isForeign: boolean
): RuleViolation[] {
  const out: RuleViolation[] = [];
  if (isForeign) {
    for (const f of [
      "line",
      "location_of_loss",
      "nature_of_loss",
      "particulars",
      "remarks",
    ] as const) {
      if (HANGUL_RE.test(side[f] || "")) {
        out.push({
          kind: "korean_in_foreign",
          message: `${f}: foreign 슬립인데 한글 잔존`,
          field: f,
        });
      }
    }
  }
  if (
    side.reinsured &&
    side.reinsured === side.reinsured.toUpperCase() &&
    /[A-Z]{4,}/.test(side.reinsured)
  ) {
    out.push({
      kind: "all_caps_reinsured",
      message: `reinsured ALL CAPS: ${side.reinsured}`,
      field: "reinsured",
    });
  }
  if (!side.doc_date || !side.doc_date.trim()) {
    out.push({ kind: "missing_doc_date", message: "doc_date 누락 → date placeholder" });
  }
  return out;
}

/* ---------- helpers ---------- */

function fmtNum(n: number): string {
  if (!n) return "-";
  return n.toLocaleString("ko-KR");
}

async function callExtract(file: File): Promise<ExtractedFields> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API_URL}/api/admin/slip-testbench/extract`, {
    method: "POST",
    body: fd,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${txt}`);
  }
  const j = (await r.json()) as { extracted: ExtractedFields };
  return j.extracted;
}

/* ---------- page component ---------- */

export default function SlipTestbenchPage() {
  const [originals, setOriginals] = useState<PdfItem[]>([]);
  const [generated, setGenerated] = useState<PdfItem[]>([]);
  const [reinsurers, setReinsurers] = useState<CodeTableReinsurer[] | null>(null);
  const [running, setRunning] = useState(false);

  // Lazy-load the code table once for foreign/domestic classification.
  useMemo(() => {
    fetch(`${API_URL}/api/tools/code-table`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.reinsurers) setReinsurers(data.reinsurers);
      })
      .catch(() => {});
  }, []);

  const lookupForeign = (name: string): boolean => {
    if (!reinsurers || !name) return HANGUL_RE.test(name) ? false : true;
    const q = name.trim().toLowerCase();
    for (const r of reinsurers) {
      if (r.code.toLowerCase() === q || r.name.toLowerCase() === q) return r.is_foreign;
    }
    for (const r of reinsurers) {
      if (q.includes(r.code.toLowerCase()) || q.includes(r.name.toLowerCase()))
        return r.is_foreign;
      if (r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
        return r.is_foreign;
    }
    return !HANGUL_RE.test(name);
  };

  const handleDrop = (side: Side) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const incoming = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)
    );
    if (!incoming.length) return;
    const items: PdfItem[] = incoming.map((f) => ({
      side,
      file: f,
      url: URL.createObjectURL(f),
      fields: null,
      error: null,
    }));
    if (side === "original") setOriginals((prev) => [...prev, ...items]);
    else setGenerated((prev) => [...prev, ...items]);
  };

  const removeItem = (side: Side, idx: number) => {
    const arr = side === "original" ? originals : generated;
    URL.revokeObjectURL(arr[idx].url);
    if (side === "original") setOriginals((p) => p.filter((_, i) => i !== idx));
    else setGenerated((p) => p.filter((_, i) => i !== idx));
  };

  const { pairs, unmatched } = useMemo(
    () => pairFiles(originals, generated),
    [originals, generated]
  );

  const runAll = async () => {
    setRunning(true);
    try {
      // Fire all extracts in parallel — admin tool, small batches.
      const allItems = [...originals, ...generated];
      await Promise.all(
        allItems.map(async (it) => {
          if (it.fields || it.error) return;
          try {
            const fields = await callExtract(it.file);
            it.fields = fields;
          } catch (e) {
            it.error = e instanceof Error ? e.message : String(e);
          }
        })
      );
      // Force re-render
      setOriginals((p) => [...p]);
      setGenerated((p) => [...p]);
    } finally {
      setRunning(false);
    }
  };

  const allExtracted = pairs.every(
    (p) => p.original.fields && p.generated.fields
  );

  /* ---------- render ---------- */
  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      <div className="border-b border-slate-900 px-6 py-4 bg-slate-900 text-white">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-300">
          Admin · Slip Testbench
        </div>
        <div className="text-[18px] font-bold mt-1">
          Original ↔ Generated 비교 도구
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          수기 슬립과 slip-generator 출력을 같은 추출 파이프라인으로 돌려 필드별 차이를 표시.
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Drop zones */}
        <div className="grid grid-cols-2 gap-4">
          <DropZone
            label="Original (수기)"
            sub="사람이 직접 만든 PLA/SOC PDF"
            items={originals}
            onDrop={handleDrop("original")}
            onRemove={(i) => removeItem("original", i)}
          />
          <DropZone
            label="Generated (AI)"
            sub="slip-generator 가 출력한 PDF"
            items={generated}
            onDrop={handleDrop("generated")}
            onRemove={(i) => removeItem("generated", i)}
          />
        </div>

        {/* Pair summary + run */}
        <div className="border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <div className="text-[12px] text-slate-700">
            <span className="font-bold">{pairs.length}</span> pairs matched ·{" "}
            <span className="text-[#b91c1c] font-bold">{unmatched.length}</span> unmatched
            {unmatched.length > 0 && (
              <span className="ml-3 text-[10px] text-slate-500 font-mono">
                {unmatched.map((u) => u.file.name).join(", ")}
              </span>
            )}
          </div>
          <button
            disabled={running || pairs.length === 0}
            onClick={runAll}
            className="px-4 py-1.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? "Extracting…" : "Run Extraction"}
          </button>
        </div>

        {/* Per-pair comparison */}
        {pairs.map((pair) => {
          const isForeign = lookupForeign(pair.reinsurer);
          return (
            <PairCard
              key={pair.key}
              pair={pair}
              isForeign={isForeign}
              expanded={pairs.length === 1 || allExtracted}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function DropZone({
  label,
  sub,
  items,
  onDrop,
  onRemove,
}: {
  label: string;
  sub: string;
  items: PdfItem[];
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div
      className="border-2 border-dashed border-slate-300 bg-white"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
          {label}
        </div>
        <div className="text-[10px] text-slate-500">{sub}</div>
      </div>
      <div className="p-3 min-h-[100px]">
        {items.length === 0 ? (
          <div className="text-[11px] text-slate-400 text-center py-8">
            여기에 PDF 드래그 앤 드롭
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((it, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate flex-1" title={it.file.name}>
                  {it.fields ? "✓ " : it.error ? "✗ " : "· "}
                  {it.file.name}
                  {it.error && (
                    <span className="text-[#b91c1c] ml-1">{it.error}</span>
                  )}
                </span>
                <button
                  onClick={() => onRemove(i)}
                  className="text-[10px] text-[#b91c1c] hover:underline"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PairCard({
  pair,
  isForeign,
  expanded: _initialExpanded,
}: {
  pair: Pair;
  isForeign: boolean;
  expanded: boolean;
}) {
  const [open, setOpen] = useState(_initialExpanded);
  const orig = pair.original.fields;
  const gen = pair.generated.fields;
  const diffs = orig && gen ? buildDiff(orig, gen) : [];
  const stats = diffs.reduce(
    (acc, d) => {
      acc[d.severity]++;
      return acc;
    },
    { match: 0, minor: 0, major: 0, missing: 0 } as Record<DiffSeverity, number>
  );
  const violations =
    orig && gen
      ? [
          ...checkRuleViolations(orig, isForeign).map((v) => ({ ...v, side: "original" as const })),
          ...checkRuleViolations(gen, isForeign).map((v) => ({ ...v, side: "generated" as const })),
        ]
      : [];

  return (
    <div className="border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono text-slate-400">
            {open ? "▼" : "▶"}
          </span>
          <span className="text-[12px] font-bold text-slate-900">
            {pair.reinsurer || "(unknown reinsurer)"}
          </span>
          <span
            className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${
              isForeign
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            {isForeign ? "Foreign" : "Domestic"}
          </span>
          {orig && gen && (
            <>
              <span className="text-[10px] text-emerald-700">
                ✓ {stats.match}
              </span>
              <span className="text-[10px] text-amber-700">
                ⚠ {stats.minor}
              </span>
              <span className="text-[10px] text-[#b91c1c]">
                ✗ {stats.major}
              </span>
              {stats.missing > 0 && (
                <span className="text-[10px] text-slate-500">
                  ∅ {stats.missing}
                </span>
              )}
              {violations.length > 0 && (
                <span className="text-[10px] text-[#9a3412] font-bold">
                  · {violations.length} rule{violations.length > 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </div>
        <div className="text-[10px] text-slate-500 font-mono truncate max-w-[40%]">
          {pair.original.file.name} ↔ {pair.generated.file.name}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {/* Side-by-side PDFs */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50">
            <PdfFrame label="Original" url={pair.original.url} />
            <PdfFrame label="Generated" url={pair.generated.url} />
          </div>

          {/* Rule violations */}
          {violations.length > 0 && (
            <div className="px-4 py-2 bg-[#fff7ed] border-y border-[#fed7aa] text-[11px]">
              <div className="font-bold uppercase tracking-wider text-[#9a3412] text-[9px] mb-1">
                Rule violations
              </div>
              <ul className="space-y-0.5 text-[#9a3412]">
                {violations.map((v, i) => (
                  <li key={i}>
                    <span className="font-mono text-[9px] uppercase mr-2">
                      [{v.side}]
                    </span>
                    {v.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Diff table */}
          {orig && gen ? (
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-mono uppercase tracking-wider text-[9px] text-slate-500 w-32">
                    Field
                  </th>
                  <th className="text-left px-3 py-2 font-mono uppercase tracking-wider text-[9px] text-slate-500">
                    Original
                  </th>
                  <th className="text-left px-3 py-2 font-mono uppercase tracking-wider text-[9px] text-slate-500">
                    Generated
                  </th>
                  <th className="text-left px-3 py-2 font-mono uppercase tracking-wider text-[9px] text-slate-500 w-24">
                    Diff
                  </th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <DiffRow key={d.key} diff={d} />
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-6 text-center text-[11px] text-slate-500">
              Run Extraction 누르면 비교 결과가 표시됨.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiffRow({ diff }: { diff: FieldDiff }) {
  const isNumeric =
    diff.key === "total_amount" || diff.key === "expenses_reserve";
  const fmtVal = (v: string) =>
    isNumeric ? fmtNum(Number(v) || 0) : v || <span className="text-slate-300">—</span>;
  const cellCls =
    "px-3 py-2 align-top break-words " +
    (diff.severity === "match"
      ? ""
      : diff.severity === "minor"
      ? "bg-amber-50"
      : diff.severity === "missing"
      ? "bg-slate-50 text-slate-500"
      : "bg-rose-50");
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="px-3 py-2 align-top font-bold text-slate-700">
        {diff.label}
      </td>
      <td className={cellCls + " whitespace-pre-wrap"}>{fmtVal(diff.original)}</td>
      <td className={cellCls + " whitespace-pre-wrap"}>{fmtVal(diff.generated)}</td>
      <td className="px-3 py-2 align-top">
        <SeverityBadge severity={diff.severity} note={diff.note} />
      </td>
    </tr>
  );
}

function SeverityBadge({
  severity,
  note,
}: {
  severity: DiffSeverity;
  note?: string;
}) {
  const styles: Record<DiffSeverity, string> = {
    match: "bg-emerald-100 text-emerald-800",
    minor: "bg-amber-100 text-amber-800",
    major: "bg-rose-100 text-rose-800",
    missing: "bg-slate-100 text-slate-600",
  };
  const labels: Record<DiffSeverity, string> = {
    match: "match",
    minor: "minor",
    major: "diff",
    missing: "missing",
  };
  return (
    <div>
      <span
        className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${styles[severity]}`}
      >
        {labels[severity]}
      </span>
      {note && (
        <div className="text-[9px] text-slate-500 mt-0.5">{note}</div>
      )}
    </div>
  );
}

function PdfFrame({ label, url }: { label: string; url: string }) {
  return (
    <div className="border border-slate-300 bg-white">
      <div className="px-2 py-1 bg-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-700">
        {label}
      </div>
      <iframe src={url} className="w-full h-[600px] border-0" title={label} />
    </div>
  );
}
