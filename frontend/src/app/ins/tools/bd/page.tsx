"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

type Tab = "lapsed" | "renewal" | "news" | "channels" | "sectors";

interface Segment {
  segment: string;
  contracts: number;
  cedants: number;
  assureds: number;
  ri_prem: string | number | null;
  recent_2y: number;
  new_3y: number;
}
type LeadStatus = "lapsed" | "expiring" | "active" | "stale" | "all";

interface LapsedLead {
  assured: string;
  years_traded: number;
  first_year: number;
  last_booking_year: number;
  last_period_to: string | null;
  days_since_expiry: number | null;
  ri_prem: string | number | null;
  annual_ri_prem: string | number | null;
  commission: string | number | null;
  annual_commission: string | number | null;
  contracts: number;
  lines: (string | null)[];
  cedants: (string | null)[];
  status: string;
}
interface NewsLead {
  company: string;
  group: string | null;
  event: string | null;
  amount_krw: number | null;
  keyword: string;
  lines: string[];
  why: string;
  relation: string;
  matched_via: string | null;
  book_contracts: number | null;
  book_years: number | null;
  book_lines: string[];
  book_cedants: string[];
  article_count: number;
  url: string;
  date: string | null;
  source: string | null;
}
interface NewsPayload {
  fetched: number;
  relevant: number;
  folded_from: number;
  counts: Record<string, number>;
  incident_count: number;
  leads: NewsLead[];
  incidents: NewsLead[];
  cached: boolean;
  note: string;
}
interface StatusCount {
  status: string;
  assureds: number;
  ri_prem: string | number | null;
  annual_commission: string | number | null;
}
interface RenewalLead {
  assured: string;
  cover_note_no: string | null;
  cedant: string | null;
  line: string | null;
  period_to: string | null;
  days_to_expiry: number | null;
  ri_prem: string | number | null;
  new_renew: string | null;
}
interface Channel {
  cedant: string | null;
  contracts: number;
  ri_prem: string | number | null;
  last_year: number;
  recent_2y: number;
  new_3y: number;
  assureds: number;
}
interface Sector {
  line: string;
  contracts: number;
  assureds: number;
  commission_rate: string | number | null;
  avg_share: string | number | null;
  ri_prem: string | number | null;
  new_count: number;
}
interface Detail {
  assured: string;
  contracts: {
    year: number; cover_note_no: string | null; cedant: string | null; line: string | null;
    reinsurer: string | null; period_from: string | null; period_to: string | null;
    ri_prem: string | number | null; workflow_status: string | null;
  }[];
  claims: { ref_no: string | null; line: string | null; dol: string | null; krw_amount: string | number | null; status: string | null }[];
  recommendation: {
    lines: string[];
    prior: { cedant: string; contracts: number; last_year: number; ri_prem: string | number | null }[];
    active: { cedant: string; new_3y: number; contracts_3y: number; ri_prem: string | number | null }[];
  };
}

const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));
/** 금액 표기 — 억/만. 환입성 마이너스가 실재하므로 부호를 유지한다. */
function money(v: string | number | null | undefined): string {
  const n = num(v);
  const a = Math.abs(n);
  // 조 단위가 없으면 4.4조 수주가 '43862.0억' 으로 나온다. 큰 값은 소수도 버린다.
  if (a >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (a >= 1e8) {
    const eok = n / 1e8;
    return `${Math.abs(eok) >= 100 ? Math.round(eok).toLocaleString() : eok.toFixed(1)}억`;
  }
  if (a >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}
const pct = (v: string | number | null | undefined, digits = 1) =>
  v == null ? "—" : `${(Number(v) * 100).toFixed(digits)}%`;

const REL_LABEL: Record<string, { label: string; tone: string; note: string }> = {
  lapsed: { label: "복구", tone: "bg-slate-900 text-white", note: "거래하다 끊긴 고객 — 가장 강한 리드" },
  existing: { label: "교차판매", tone: "bg-slate-700 text-white", note: "거래 이력 있음" },
  active: { label: "진행중", tone: "bg-slate-100 text-slate-600", note: "현재 계약 유효" },
  new: { label: "신규", tone: "bg-white text-slate-500 border border-slate-300", note: "원장에 없음" },
};

/** 담보종기 기준 구분 — services/bd.py 의 LEAD_STATUS 와 같은 축. */
const STATUS_TABS: { key: LeadStatus; label: string; desc: string }[] = [
  { key: "lapsed", label: "이탈 1~4년", desc: "담보종기 1~4년 경과 — 진짜 이탈, 전환 가능성 최상" },
  { key: "expiring", label: "최근만료", desc: "담보종기 1년 내 — 이탈이 아니라 갱신 협상 대상" },
  { key: "stale", label: "오래된 이탈", desc: "담보종기 4년 초과 — 전환율 낮음" },
  { key: "active", label: "진행중", desc: "담보종기가 미래 — 다년 계약 진행 중, 리드 아님" },
  { key: "all", label: "전체", desc: "전 구간" },
];

/** 출재사 채널 판정 — services/bd.py 의 축과 같은 기준. */
function verdict(c: Channel): { label: string; tone: string } {
  if (c.recent_2y === 0) return { label: "휴면", tone: "text-[#b91c1c]" };
  if (c.new_3y >= 15) return { label: "성장", tone: "text-emerald-700" };
  if (c.recent_2y >= 50) return { label: "유지", tone: "text-slate-700" };
  return { label: "축소", tone: "text-[#b45309]" };
}

export default function BdPage() {
  const [tab, setTab] = useState<Tab>("lapsed");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [lapsed, setLapsed] = useState<LapsedLead[]>([]);
  const [renewal, setRenewal] = useState<RenewalLead[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [criteria, setCriteria] = useState("");
  const [status, setStatus] = useState<LeadStatus>("lapsed");
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [news, setNews] = useState<NewsPayload | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // allSettled — 엔드포인트 하나가 죽어도 나머지 탭은 살려둔다.
    // (Promise.all 은 하나만 실패해도 페이지 전체가 빈 화면이 된다)
    const get = (path: string) =>
      fetch(`${API_URL}/api/tools/bd/${path}`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`${path} → HTTP ${r.status}`)),
      );
    const [sg, lp, rn, ch, sc, st] = await Promise.allSettled([
      get("segments"),
      get(`leads?kind=lapsed&status=${status}`),
      get("leads?kind=renewal&months_ahead=18"),
      get("channels"),
      get("sectors"),
      get("lead-status"),
    ]);

    const failed: string[] = [];
    if (sg.status === "fulfilled") setSegments(sg.value); else failed.push("segments");
    if (lp.status === "fulfilled") {
      setLapsed(lp.value.leads ?? []);
      setCriteria(lp.value.criteria ?? "");
    } else failed.push("이탈 리드");
    if (rn.status === "fulfilled") setRenewal(rn.value.leads ?? []); else failed.push("갱신 예정");
    if (ch.status === "fulfilled") setChannels(ch.value); else failed.push("출재사 채널");
    if (sc.status === "fulfilled") setSectors(sc.value); else failed.push("섹터");
    if (st.status === "fulfilled") setStatusCounts(st.value); else failed.push("구분 집계");

    setError(failed.length ? `일부를 불러오지 못했습니다: ${failed.join(", ")}` : null);
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  // 뉴스 발굴은 수집+LLM 추출로 90초 가까이 걸린다 — 탭을 열 때만 부른다.
  const loadNews = useCallback(async (refresh = false) => {
    setNewsLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/tools/bd/news-leads?days=21${refresh ? "&refresh=true" : ""}`);
      setNews(r.ok ? await r.json() : null);
    } catch {
      setNews(null);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "news" && !news && !newsLoading) loadNews();
  }, [tab, news, newsLoading, loadNews]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let alive = true;
    fetch(`${API_URL}/api/tools/bd/lead?assured=${encodeURIComponent(selected)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) setDetail(d); })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [selected]);

  const direct = segments.find((s) => s.segment === "direct");
  const retro = segments.find((s) => s.segment === "retro");

  const TABS: { key: Tab; label: string; sub: string; count?: number }[] = [
    { key: "lapsed", label: "이탈 리드", sub: "복구 대상", count: lapsed.length },
    { key: "renewal", label: "갱신 예정", sub: "만료 임박", count: renewal.length },
    { key: "news", label: "뉴스 발굴", sub: "외부 신호 (Phase 2)", count: news?.leads.length },
    { key: "channels", label: "출재사 채널", sub: "우리 고객", count: channels.length },
    { key: "sectors", label: "섹터", sub: "종목 지표", count: sectors.length },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">영업 발굴</h1>
        <p className="text-[12px] text-slate-400 mt-0.5">
          Business Development — 계약 원장에서 리드를 산출합니다 (읽기 전용)
        </p>
      </div>

      {/* 세그먼트 근거 — 왜 원보험 출재만 보는지 화면에 남긴다 */}
      {direct && retro && (
        <Card title="SEGMENT" sub="원보험 출재만 대상">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200">
            {[
              { k: "원보험 출재 (direct/fac)", s: direct, on: true },
              { k: "재재보험 (retrocession)", s: retro, on: false },
            ].map(({ k, s, on }) => (
              <div key={k} className={`px-4 py-3 ${on ? "bg-white" : "bg-slate-50"}`}>
                <div className="flex items-baseline justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${on ? "text-slate-700" : "text-slate-400"}`}>
                    {k}
                  </span>
                  {on ? (
                    <span className="text-[10px] uppercase tracking-wider bg-slate-900 text-white px-1.5 py-0.5">대상</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5">제외</span>
                  )}
                </div>
                <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-700">
                  계약 {s.contracts.toLocaleString()} · 출재사 {s.cedants} · 피보험자 {s.assureds.toLocaleString()} ·{" "}
                  {money(s.ri_prem)} · <span className="font-bold">최근3년 신규 {s.new_3y}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
            <code className="bg-slate-100 px-1">cedant</code> 자리에 재보험사(Korean Re 등)가 오는 건은 재재보험이라
            영업 성격이 다릅니다. 신규는 원보험 출재 {direct.new_3y}건 vs 재재보험 {retro.new_3y}건 —
            신규 영업은 원보험 출재에서만 나옵니다. 출재사 표기는 2017년 별칭(Samsung=SS, Hanwha=HW, Hyundai=HM,
            Lotte=LT, Dongbu=DB)을 병합했고, <code className="bg-slate-100 px-1">assured</code> 에 섞인 특약명 행은 제외했습니다.
          </p>
        </Card>
      )}

      {error && (
        <div className="border border-[#b91c1c] bg-white px-4 py-3 text-[12px] text-[#b91c1c]">{error}</div>
      )}

      {/* 탭 */}
      <div className="flex border border-slate-300 w-fit">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            title={t.sub}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${i > 0 ? "border-l border-slate-300" : ""} ${
              tab === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 font-mono">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[12px] text-slate-400 py-8">불러오는 중…</div>
      ) : (
        <>
          {tab === "lapsed" && (
            <Card title="LEADS BY POLICY EXPIRY" sub={criteria}>
              {/* 구분 선택기 — '이탈'이 무엇을 뜻하는지 눌러보며 확인할 수 있게 */}
              <div className="mb-3 flex flex-wrap gap-px bg-slate-200 border border-slate-200">
                {STATUS_TABS.map((st) => {
                  const c = statusCounts.find((x) => x.status === st.key);
                  const on = status === st.key;
                  return (
                    <button
                      key={st.key}
                      onClick={() => setStatus(st.key)}
                      title={st.desc}
                      className={`px-3 py-2 text-left transition-colors ${on ? "bg-slate-900" : "bg-white hover:bg-slate-50"}`}
                    >
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${on ? "text-white" : "text-slate-600"}`}>
                        {st.label}
                      </div>
                      <div className={`text-[10px] font-mono tabular-nums ${on ? "text-slate-300" : "text-slate-400"}`}>
                        {c ? `${c.assureds}곳 · 연수수료 ${money(c.annual_commission)}` : "—"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="mb-2 text-[10px] text-slate-400 leading-relaxed">
                판정 기준은 <b>담보종기(period_to)</b> 입니다. 부킹연도(<code className="bg-slate-100 px-1">year</code>)로
                보면 정산 조정 행이 나중 연도에 붙어 이미 오래 끝난 건이 &lsquo;최근 이탈&rsquo;로 올라옵니다
                (예: Kumho Tire 는 2024년 부킹이 있으나 담보는 2023-03-07 종료).
                정렬은 <b>연평균 출재수수료</b> — 우리가 실제로 번 돈이고 거래연수 편향도 없습니다.
              </p>

              <Table
                head={["피보험자", "연수", "담보종기", "경과", "연수수료", "연평균 보험료", "누적 보험료", "종목", "출재사"]}
                align={["l", "r", "c", "r", "r", "r", "r", "l", "l"]}
                rows={lapsed.map((r) => [
                  <button key="a" onClick={() => setSelected(r.assured)}
                    className="font-semibold text-left hover:text-[#1e40af] hover:underline">
                    {r.assured}
                  </button>,
                  `${r.years_traded}년`,
                  r.last_period_to ?? "—",
                  r.days_since_expiry == null
                    ? "—"
                    : r.days_since_expiry < 0
                      ? `+${Math.abs(r.days_since_expiry)}일`
                      : `${r.days_since_expiry}일`,
                  <b key="c">{money(r.annual_commission)}</b>,
                  money(r.annual_ri_prem),
                  money(r.ri_prem),
                  (r.lines.filter(Boolean) as string[]).join(", "),
                  (r.cedants.filter(Boolean) as string[]).join(", "),
                ])}
                empty="이 구분에 해당하는 피보험자가 없습니다."
              />
            </Card>
          )}

          {tab === "renewal" && (
            <Card title="RENEWAL PIPELINE" sub="향후 18개월 만료">
              <Table
                head={["피보험자", "커버노트", "출재사", "종목", "만료일", "D-", "ri_prem", "구분"]}
                align={["l", "l", "l", "l", "c", "r", "r", "c"]}
                rows={renewal.map((r) => [
                  <button key="a" onClick={() => setSelected(r.assured)}
                    className="font-semibold text-left hover:text-[#1e40af] hover:underline">
                    {r.assured}
                  </button>,
                  r.cover_note_no ?? "—",
                  r.cedant ?? "—",
                  r.line ?? "—",
                  r.period_to ?? "—",
                  r.days_to_expiry != null ? `${r.days_to_expiry}일` : "—",
                  money(r.ri_prem),
                  r.new_renew === "N" ? "신규" : r.new_renew === "R" ? "갱신" : (r.new_renew ?? "—"),
                ])}
                empty="향후 18개월 내 만료 예정 계약이 없습니다. (2026년 데이터가 부분 적재일 수 있습니다)"
              />
            </Card>
          )}

          {tab === "news" && (
            <Card
              title="NEWS DISCOVERY"
              sub={news ? `수집 ${news.fetched} → 유효 ${news.relevant} → 사건 ${news.leads.length + news.incident_count}건${news.cached ? " · 캐시" : ""}` : "Phase 2"}
              action={
                <button
                  onClick={() => loadNews(true)}
                  disabled={newsLoading}
                  className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900 disabled:opacity-40"
                >
                  {newsLoading ? "수집 중…" : "다시 수집"}
                </button>
              }
            >
              <p className="mb-3 text-[10px] text-slate-400 leading-relaxed">
                argo <code className="bg-slate-100 px-1">news_search</code> 로 착공·준공·증설·수주·리콜 등
                10개 키워드를 수집하고, 회사·이벤트·금액을 뽑아 <b>우리 계약 원장과 대조</b>합니다.
                한글 사명은 영문·옛 사명 별칭으로 매칭합니다(한화오션↔Daewoo Shipbuilding, GS건설↔GS E&C) —
                원장 피보험자의 65%가 영문 표기라 별칭 없이는 기존 고객을 전부 &lsquo;신규&rsquo;로 오분류합니다.
                <b className="text-[#b45309]"> 후보 목록이며 아무것도 확정하지 않습니다 — 승격은 사람이 판정합니다.</b>
              </p>

              {newsLoading && !news ? (
                <div className="text-[12px] text-slate-400 py-6">
                  뉴스 수집 + 회사 추출 중… 90초 정도 걸립니다.
                </div>
              ) : !news ? (
                <div className="text-[11px] text-[#b91c1c]">
                  뉴스 발굴을 불러오지 못했습니다. ARGO_MCP_URL·ANTHROPIC_API_KEY 설정을 확인해 주세요.
                </div>
              ) : (
                <div className="space-y-4">
                  <Table
                    head={["관계", "회사", "사건", "금액", "예상 종목", "우리 원장", "기사", "날짜"]}
                    align={["c", "l", "l", "r", "l", "l", "c", "c"]}
                    rows={news.leads.map((n) => {
                      const rel = REL_LABEL[n.relation] ?? REL_LABEL.new;
                      return [
                        <span key="r" title={rel.note}
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${rel.tone}`}>
                          {rel.label}
                        </span>,
                        <span key="c" className="font-semibold">
                          {n.company}
                          {n.group && <span className="text-slate-400 font-normal"> · {n.group}</span>}
                        </span>,
                        <a key="e" href={n.url} target="_blank" rel="noreferrer"
                          className="hover:text-[#1e40af] hover:underline">
                          {n.event ?? "—"}
                        </a>,
                        n.amount_krw ? money(n.amount_krw) : "—",
                        n.lines.join(", "),
                        n.book_contracts
                          ? `${n.book_contracts}건/${n.book_years}년 · ${n.book_lines.slice(0, 2).join(",")} · ${n.book_cedants.slice(0, 2).join(",")}`
                          : "—",
                        n.article_count > 1 ? `${n.article_count}` : "1",
                        n.date ?? "—",
                      ];
                    })}
                    empty="뉴스에서 나온 후보가 없습니다."
                  />

                  {news.incidents.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b45309] mb-1">
                        사고 신호 {news.incidents.length}건
                      </div>
                      <p className="mb-2 text-[10px] text-slate-400">
                        화재·리콜·소송·투자철회 등 <b>이미 벌어진 일</b>입니다. 새 수요가 아니라 리스크
                        신호이므로 영업 리드에서 분리했습니다. 우리 고객이면 클레임·갱신 협상 쪽에서 봐야 합니다.
                      </p>
                      <Table
                        head={["회사", "사건", "우리 원장", "기사", "날짜"]}
                        align={["l", "l", "l", "c", "c"]}
                        rows={news.incidents.map((n) => [
                          <span key="c" className="font-semibold">{n.company}</span>,
                          <a key="e" href={n.url} target="_blank" rel="noreferrer"
                            className="hover:text-[#1e40af] hover:underline">{n.event ?? "—"}</a>,
                          n.book_contracts
                            ? `우리 고객 · ${n.book_contracts}건 · ${n.book_cedants.slice(0, 2).join(",")}`
                            : "우리 고객 아님",
                          n.article_count > 1 ? `${n.article_count}` : "1",
                          n.date ?? "—",
                        ])}
                        empty=""
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {tab === "channels" && (
            <Card title="CEDANT CHANNELS" sub="2017 표기 별칭 병합 후">
              <Table
                head={["출재사", "계약", "ri_prem", "피보험자", "마지막", "최근2년", "신규3y", "판정"]}
                align={["l", "r", "r", "r", "c", "r", "r", "c"]}
                rows={channels.map((c) => {
                  const v = verdict(c);
                  return [
                    <span key="c" className="font-semibold">{c.cedant ?? "—"}</span>,
                    c.contracts.toLocaleString(),
                    money(c.ri_prem),
                    c.assureds.toLocaleString(),
                    String(c.last_year),
                    c.recent_2y.toLocaleString(),
                    String(c.new_3y),
                    <span key="v" className={`font-bold ${v.tone}`}>{v.label}</span>,
                  ];
                })}
                empty="출재사 데이터가 없습니다."
              />
            </Card>
          )}

          {tab === "sectors" && (
            <Card title="SECTORS" sub="2023년 이후 · 요율 아님">
              <p className="mb-2 text-[10px] text-[#b45309] leading-relaxed">
                ⚠ <b>요율(rate)은 산출할 수 없습니다</b> — 계약 원장에 보험가입금액 컬럼이 없어 분모가 없습니다.
                아래는 대용 축(출재수수료율 = ri_commission/ri_prem, 평균지분, 보험료 규모)입니다.
                피보험자 수가 적은 종목은 소수 계약에 좌우되니 함께 보세요.
              </p>
              <Table
                head={["종목", "계약", "피보험자", "출재수수료율", "평균지분", "ri_prem", "신규"]}
                align={["l", "r", "r", "r", "r", "r", "r"]}
                rows={sectors.map((s) => [
                  <span key="l" className="font-semibold">{s.line}</span>,
                  s.contracts.toLocaleString(),
                  s.assureds.toLocaleString(),
                  pct(s.commission_rate),
                  pct(s.avg_share),
                  money(s.ri_prem),
                  <span key="n" className={s.new_count >= 15 ? "font-bold text-emerald-700" : ""}>
                    {s.new_count}
                  </span>,
                ])}
                empty="섹터 데이터가 없습니다."
              />
            </Card>
          )}
        </>
      )}

      {/* 리드 상세 */}
      {selected && (
        <Card
          title="LEAD DETAIL"
          sub={selected}
          action={
            <button onClick={() => setSelected(null)}
              className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-700">
              닫기 ✕
            </button>
          }
        >
          {!detail ? (
            <div className="text-[12px] text-slate-400">불러오는 중…</div>
          ) : (
            <div className="space-y-4">
              {/* 출재사 추천 — 이 툴의 핵심 산출물 */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 mb-1">
                  출재사 추천
                </div>
                <p className="text-[10px] text-slate-400 mb-2">
                  재보험 브로커의 고객은 피보험자가 아니라 출재사입니다. 이 리드를 어느 출재사에게
                  넘길지를 우리 거래 이력에서 산출합니다. 종목: {detail.recommendation.lines.join(", ") || "—"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200">
                  <div className="bg-white p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                      과거 거래 있음 · 관계
                    </div>
                    {detail.recommendation.prior.length === 0 ? (
                      <div className="text-[11px] text-slate-400">없음</div>
                    ) : (
                      detail.recommendation.prior.map((p) => (
                        <div key={p.cedant} className="text-[11px] font-mono tabular-nums text-slate-700">
                          <b>{p.cedant}</b> · {p.contracts}건 · last {p.last_year} · {money(p.ri_prem)}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="bg-white p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                      이 종목 신규 실적 · 인수 의지
                    </div>
                    {detail.recommendation.active.length === 0 ? (
                      <div className="text-[11px] text-slate-400">없음</div>
                    ) : (
                      detail.recommendation.active.map((a) => (
                        <div key={a.cedant} className="text-[11px] font-mono tabular-nums text-slate-700">
                          <b>{a.cedant}</b> · 신규 {a.new_3y} / 3년내 {a.contracts_3y}건 · {money(a.ri_prem)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 mb-1">
                  계약 이력 <span className="text-slate-400 font-normal">({detail.contracts.length}건, 최대 60)</span>
                </div>
                <Table
                  head={["연도", "커버노트", "출재사", "종목", "재보험사", "보험기간", "ri_prem", "상태"]}
                  align={["c", "l", "l", "l", "l", "c", "r", "c"]}
                  rows={detail.contracts.map((c) => [
                    String(c.year),
                    c.cover_note_no ?? "—",
                    c.cedant ?? "—",
                    c.line ?? "—",
                    c.reinsurer ?? "—",
                    `${c.period_from ?? "?"} ~ ${c.period_to ?? "?"}`,
                    money(c.ri_prem),
                    c.workflow_status ?? "—",
                  ])}
                  empty="계약 이력이 없습니다."
                />
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 mb-1">
                  클레임 이력{" "}
                  <span className="text-slate-400 font-normal">
                    ({detail.claims.length}건 · account_name 부분일치)
                  </span>
                </div>
                {detail.claims.length === 0 ? (
                  <div className="text-[11px] text-slate-400">
                    일치하는 클레임이 없습니다. 계약의 assured 와 클레임의 account_name 표기가 달라 못 찾는 경우도 있습니다.
                  </div>
                ) : (
                  <Table
                    head={["Ref No", "종목", "사고일", "KRW", "상태"]}
                    align={["l", "l", "c", "r", "c"]}
                    rows={detail.claims.map((c) => [
                      c.ref_no ?? "—", c.line ?? "—", c.dol ?? "—", money(c.krw_amount), c.status ?? "—",
                    ])}
                    empty=""
                  />
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Card({ title, sub, action, children }: {
  title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 bg-white">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">{title}</span>
        <span className="flex items-baseline gap-3 min-w-0">
          {sub && <span className="text-[10px] text-slate-400 truncate">{sub}</span>}
          {action}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** 넓은 표가 페이지를 밀지 않도록 자체 스크롤 컨테이너에 넣는다 (DESIGN.md). */
function Table({ head, rows, align, empty }: {
  head: string[]; rows: React.ReactNode[][]; align: ("l" | "c" | "r")[]; empty: string;
}) {
  const cls = (i: number) =>
    align[i] === "r" ? "text-right" : align[i] === "c" ? "text-center" : "text-left";
  if (rows.length === 0) return <div className="text-[11px] text-slate-400">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-white border-b border-slate-200">
            {head.map((h, i) => (
              <th key={h} className={`px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap ${cls(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50">
              {r.map((cell, ci) => (
                <td key={ci} className={`px-2 py-2 font-mono tabular-nums text-slate-800 align-top ${cls(ci)}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
