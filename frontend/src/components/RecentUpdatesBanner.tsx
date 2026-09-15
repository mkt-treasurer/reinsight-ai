"use client";

/**
 * Slim banner that surfaces the most recent changelog entries inside a
 * working page (e.g. the slip-generator). Collapsed by default to the
 * single latest headline; expands to show up to 3 recent entries with
 * a deep-link to /ins/whats-new.
 *
 * Filter by `area` to limit which entries are eligible — passing
 * "slip-generator" shows only slip-generator changes.
 */

import { useState } from "react";
import Link from "next/link";
import {
  CHANGELOG_ENTRIES,
  ChangelogArea,
  ChangelogEntry,
} from "@/data/changelog/entries";

interface Props {
  /** When set, restricts the banner to this area's entries. */
  area?: ChangelogArea;
  /** Max entries shown when expanded (newest first). Default 3. */
  limit?: number;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ko-KR", {
    month: "short",
    day: "2-digit",
  });
}

function recent(area: ChangelogArea | undefined, limit: number): ChangelogEntry[] {
  let xs = CHANGELOG_ENTRIES;
  if (area) xs = xs.filter((e) => e.area === area);
  return [...xs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

export default function RecentUpdatesBanner({ area, limit = 3 }: Props) {
  const [open, setOpen] = useState(false);
  const entries = recent(area, limit);
  if (entries.length === 0) return null;
  const latest = entries[0];

  return (
    <div className="border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-slate-50"
      >
        <span className="text-[9px] font-bold tracking-[0.2em] uppercase bg-slate-900 text-white px-1.5 py-0.5 shrink-0">
          New
        </span>
        <span className="text-[10px] font-mono text-slate-500 shrink-0">
          {formatDateShort(latest.date)}
        </span>
        <span className="text-[12px] text-slate-900 font-bold truncate flex-1">
          {latest.title}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
          최근 {entries.length} 건
        </span>
        <span className="text-[10px] font-mono text-slate-400 shrink-0">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-200 divide-y divide-slate-100">
          {entries.map((e) => (
            <Link
              key={e.id}
              href="/ins/whats-new"
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50"
            >
              <span className="text-[10px] font-mono text-slate-500 w-14 shrink-0 mt-px">
                {formatDateShort(e.date)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-slate-900">
                  {e.title}
                </div>
                {e.ref && (
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono mt-0.5">
                    {e.ref}
                  </div>
                )}
              </div>
            </Link>
          ))}
          <Link
            href="/ins/whats-new"
            className="block px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-50 text-right"
          >
            전체 업데이트 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
