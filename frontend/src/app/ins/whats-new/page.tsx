"use client";

/**
 * What's New — operator-facing changelog timeline.
 *
 * Renders curated release notes (frontend/src/data/changelog/entries.ts)
 * with a per-entry "Copy as Markdown" button so the operator can paste
 * the same text directly into a reply email to the cedant.
 *
 * Filters: area (slip-generator / soc / claims / platform / all) and a
 * customer-visible-only toggle. No backend round-trip — the file is
 * source-of-truth and bundled at build time.
 */

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  CHANGELOG_ENTRIES,
  ChangelogArea,
  ChangelogEntry,
} from "@/data/changelog/entries";

type AreaFilter = ChangelogArea | "all";

const AREA_LABELS: Record<ChangelogArea, string> = {
  "slip-generator": "Slip Generator",
  soc: "SOC",
  claims: "Claims",
  placement: "Placement",
  news: "News",
  platform: "Platform",
};

const AREA_ORDER: AreaFilter[] = [
  "all",
  "slip-generator",
  "soc",
  "claims",
  "placement",
  "news",
  "platform",
];

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    weekday: "short",
  });
}

export default function WhatsNewPage() {
  const [area, setArea] = useState<AreaFilter>("all");
  const [customerOnly, setCustomerOnly] = useState(false);

  const entries = useMemo(() => {
    let xs = [...CHANGELOG_ENTRIES];
    if (area !== "all") xs = xs.filter((e) => e.area === area);
    if (customerOnly) xs = xs.filter((e) => e.customerVisible);
    return xs.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [area, customerOnly]);

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      <div className="border-b border-slate-900 px-6 py-4 bg-slate-900 text-white">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-300">
          What's New
        </div>
        <div className="text-[18px] font-bold mt-1">업데이트 이력</div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          슬립 생성기를 포함한 InsightRe 변경사항. 고객 회신 메일에 그대로
          붙여넣을 수 있는 형태로 작성됨.
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-px bg-slate-200">
            {AREA_ORDER.map((a) => (
              <button
                key={a}
                onClick={() => setArea(a)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold ${
                  area === a
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {a === "all" ? "All" : AREA_LABELS[a]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={customerOnly}
              onChange={(e) => setCustomerOnly(e.target.checked)}
              className="accent-slate-900"
            />
            <span className="uppercase tracking-wider text-[10px] font-bold">
              고객 공개 항목만
            </span>
          </label>
        </div>

        {/* Timeline */}
        {entries.length === 0 ? (
          <div className="border border-slate-200 bg-white px-4 py-10 text-center text-[11px] text-slate-500">
            조건에 맞는 변경사항이 없습니다.
          </div>
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} />
              </li>
            ))}
          </ol>
        )}

        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
          총 {entries.length} 건 · 최신순
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const md = `## ${entry.title}\n_${formatDate(entry.date)} · ${
      AREA_LABELS[entry.area]
    }${entry.ref ? ` · ${entry.ref}` : ""}_\n\n${entry.body}`;
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };
  return (
    <div className="border border-slate-200 bg-white">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700 shrink-0">
            {AREA_LABELS[entry.area]}
          </span>
          <span className="text-[10px] text-slate-400 font-mono shrink-0">
            {formatDate(entry.date)}
          </span>
          {entry.ref && (
            <span className="text-[9px] uppercase tracking-wider text-slate-500 border border-slate-300 px-1.5 py-0.5 shrink-0">
              {entry.ref}
            </span>
          )}
          {entry.customerVisible && (
            <span className="text-[9px] uppercase tracking-wider text-emerald-700 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 shrink-0">
              Customer
            </span>
          )}
        </div>
        <button
          onClick={onCopy}
          className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border border-slate-300 text-slate-700 hover:bg-white shrink-0"
        >
          {copied ? "Copied" : "Copy as Markdown"}
        </button>
      </div>
      <div className="p-4">
        <div className="text-[14px] font-bold text-slate-900 mb-2">
          {entry.title}
        </div>
        <article className="prose-changelog text-[12px] text-slate-700 leading-relaxed">
          <ReactMarkdown
            components={{
              h3: (props) => (
                <h3
                  className="text-[11px] font-bold tracking-[0.15em] uppercase text-slate-900 mt-4 mb-1.5 first:mt-0"
                  {...props}
                />
              ),
              p: (props) => <p className="my-1.5" {...props} />,
              ul: (props) => (
                <ul className="my-1.5 pl-4 list-disc space-y-0.5" {...props} />
              ),
              li: (props) => <li {...props} />,
              code: (props) => (
                <code
                  className="bg-slate-100 px-1 py-px text-[11px] font-mono text-slate-900"
                  {...props}
                />
              ),
              strong: (props) => (
                <strong className="font-bold text-slate-900" {...props} />
              ),
            }}
          >
            {entry.body}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
