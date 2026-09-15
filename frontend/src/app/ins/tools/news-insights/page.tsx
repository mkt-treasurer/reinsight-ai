"use client";

// News-insights dashboard — reinsurance business-development news feed.
// Self-contained / experimental: talks only to the isolated /api/tools/news
// backend (no DB), mirroring rq-slip and weekly-dashboard.
//
// Four curated topics. Each pulls equal-weight items from Perigon (global) and
// Naver (Korean), then Gemini distills 2–3 sales-angle insights per topic.
// The feed is cached server-side for the day; REFRESH forces a live rebuild.
//
// Styling follows DESIGN.md: slate palette + single red accent, sharp corners,
// no colored card fills, no emoji.

import { useCallback, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";
const BASE = `${API_URL}/api/tools/news`;

// ─── types (mirror routers/news.py payload) ────────────────────────────────
interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
  snippet: string;
  lang: "ko" | "en";
  image_url: string | null;
}
interface TopicFeed {
  id: string;
  label: string;
  description: string;
  insights: string[];
  items: NewsItem[];
  counts: { korea: number; global: number };
}
interface Feed {
  date: string;
  generated_at: string;
  per_source: number;
  sources: { perigon: boolean; naver: boolean };
  topics: TopicFeed[];
}

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtWhen(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ─── page ─────────────────────────────────────────────────────────────────
export default function NewsInsightsPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      // GET → today's cached feed; POST /refresh → force a live rebuild.
      const resp = refresh
        ? await fetch(`${BASE}/refresh`, { method: "POST" })
        : await fetch(BASE, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setFeed(await resp.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      refresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const busy = loading || refreshing;

  return (
    <div className="-m-5">
      {/* header */}
      <div className="border-b border-slate-900 px-6 py-4 flex items-center gap-6 bg-slate-900 text-white flex-wrap">
        <div>
          <div className="text-[11px] font-bold tracking-[0.2em] uppercase">News Insights</div>
          <div className="text-[10px] text-slate-400 tracking-wider">재보험 영업 뉴스 인사이트 · 글로벌 + 국내</div>
        </div>
        {feed && (
          <div className="text-[10px] text-slate-400 tracking-wider">
            갱신 {fmtWhen(feed.generated_at)} · 주제당 소스별 {feed.per_source}건
          </div>
        )}
        <button
          onClick={() => load(true)}
          disabled={busy}
          className="ml-auto bg-[#b91c1c] hover:bg-[#991b1b] disabled:opacity-50 text-white text-[10px] uppercase tracking-[0.15em] font-semibold px-3 py-1.5 transition-colors"
        >
          {refreshing ? "갱신 중…" : "Refresh"}
        </button>
      </div>

      <div className="p-6">
        {error && (
          <div className="border border-[#b91c1c] text-[#b91c1c] text-[11px] px-4 py-3 mb-5">
            오류: {error}
          </div>
        )}

        {feed && (feed.sources && (!feed.sources.perigon || !feed.sources.naver)) && (
          <div className="border border-[#b45309] text-[#b45309] text-[11px] px-4 py-3 mb-5">
            소스 일부 미설정 — Perigon: {feed.sources.perigon ? "ok" : "missing"} · Naver:{" "}
            {feed.sources.naver ? "ok" : "missing"}. (.env 키 확인)
          </div>
        )}

        {loading && !feed && (
          <div className="min-h-[40vh] grid place-items-center text-[10px] uppercase tracking-[0.3em] text-slate-400">
            Loading…
          </div>
        )}

        <div className="space-y-6">
          {feed?.topics.map((t) => (
            <TopicSection key={t.id} topic={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── topic section ──────────────────────────────────────────────────────────
function TopicSection({ topic }: { topic: TopicFeed }) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-[12px] font-bold tracking-[0.1em] uppercase text-slate-800">{topic.label}</span>
          <span className="text-[10px] text-slate-400">{topic.description}</span>
        </div>
        <span className="text-[10px] text-slate-400 tracking-wider tabular-nums">
          국내 {topic.counts.korea} · 글로벌 {topic.counts.global}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* news list */}
        <ul className="divide-y divide-slate-100">
          {topic.items.length === 0 && (
            <li className="px-4 py-6 text-[11px] text-slate-400">관련 기사를 찾지 못했습니다.</li>
          )}
          {topic.items.map((it, i) => (
            <li key={`${it.url}-${i}`} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <LangBadge lang={it.lang} />
                <div className="min-w-0">
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-semibold text-slate-900 hover:text-[#1e40af] hover:underline leading-snug"
                  >
                    {it.title}
                  </a>
                  {it.snippet && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{it.snippet}</p>
                  )}
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    {it.source || "—"} · {fmtWhen(it.published_at)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* insights panel */}
        <aside className="border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/60">
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#b91c1c]" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">영업 시사점</span>
          </div>
          {topic.insights.length === 0 ? (
            <p className="px-4 py-4 text-[11px] text-slate-400">시사점 없음 (또는 생성 실패).</p>
          ) : (
            <ul className="px-4 py-3 space-y-2.5">
              {topic.insights.map((ins, i) => (
                <li key={i} className="text-[11px] text-slate-700 leading-relaxed flex gap-2">
                  <span className="text-[#b91c1c] font-bold shrink-0">{i + 1}</span>
                  <span>{ins}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}

function LangBadge({ lang }: { lang: "ko" | "en" }) {
  const isKo = lang === "ko";
  return (
    <span
      className={`shrink-0 mt-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
        isKo ? "border-slate-900 text-slate-900" : "border-slate-300 text-slate-400"
      }`}
    >
      {isKo ? "국내" : "글로벌"}
    </span>
  );
}
