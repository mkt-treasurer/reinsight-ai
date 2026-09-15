"use client";

// Satisfaction survey — lightweight feedback on the INS desk features.
// Standalone page at /survey (NOT under the /ins desk layout): no sidebar,
// no nav link — a shareable link you hand to real users. Talks only to the
// isolated /api/tools/survey backend (no DB).
//
// Two views (tabs): "설문 참여" collects one respondent's answers, "결과"
// aggregates every stored response into desk-friendly summary stats.
//
// Styling follows DESIGN.md: slate palette + single red accent, sharp corners,
// no colored card fills, no emoji.

import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";
const BASE = `${API_URL}/api/tools/survey`;

// Feature catalogue — MUST stay in sync with routers/survey.py FEATURES.
const FEATURES: { key: string; label: string; sub: string }[] = [
  { key: "claims", label: "Claims", sub: "보험금" },
  { key: "premium", label: "Premium", sub: "보험료" },
  { key: "policies", label: "Policies", sub: "증권" },
  { key: "documents", label: "Documents", sub: "문서" },
  { key: "agent", label: "AI Agent", sub: "에이전트" },
  { key: "slip_generator", label: "Slip Generator", sub: "슬립 생성" },
  { key: "rq_slip", label: "RQ Slip", sub: "플레이스먼트" },
  { key: "weekly", label: "Weekly", sub: "주간 대시보드" },
  { key: "ops", label: "Operations", sub: "계약관리" },
  { key: "news", label: "News Insights", sub: "뉴스" },
];
const FEATURE_LABEL: Record<string, { label: string; sub: string }> =
  Object.fromEntries(FEATURES.map((f) => [f.key, { label: f.label, sub: f.sub }]));

// ─── types (mirror routers/survey.py /results payload) ──────────────────────
interface FeatureResult {
  key: string;
  label: string;
  avg: number | null;
  responses: number;
  distribution: Record<string, number>;
  most_useful_votes: number;
}
interface Comment {
  id: string;
  submitted_at: string;
  respondent: string;
  team: string;
  overall: number;
  likes: string;
  improvements: string;
}
interface Results {
  total: number;
  overall_avg: number | null;
  overall_distribution: Record<string, number>;
  recommend_avg: number | null;
  recommend_responses: number;
  nps: number | null;
  features: FeatureResult[];
  comments: Comment[];
  latest_at: string | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtWhen(iso: string | null): string {
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

const OVERALL_HINT: Record<number, string> = {
  1: "매우 불만족",
  2: "불만족",
  3: "보통",
  4: "만족",
  5: "매우 만족",
};

// ─── small controls ─────────────────────────────────────────────────────────
function RatingPicker({
  value,
  onChange,
  allowNa = false,
}: {
  value: number;
  onChange: (v: number) => void;
  allowNa?: boolean;
}) {
  return (
    <div className="flex items-center gap-px">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-8 h-8 text-[12px] font-mono tabular-nums border transition-colors ${
              active
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {n}
          </button>
        );
      })}
      {allowNa && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className={`ml-1 h-8 px-2 text-[9px] uppercase tracking-[0.15em] border transition-colors ${
            value === 0
              ? "bg-slate-900 border-slate-900 text-white"
              : "bg-white border-slate-300 text-slate-500 hover:bg-slate-50"
          }`}
        >
          미사용
        </button>
      )}
    </div>
  );
}

function MiniBar({
  distribution,
  total,
}: {
  distribution: Record<string, number>;
  total: number;
}) {
  // 5 segments (score 1..5). Higher scores darker.
  const shades = ["#e2e8f0", "#cbd5e1", "#94a3b8", "#475569", "#0f172a"];
  return (
    <div className="flex h-2 w-full overflow-hidden bg-slate-100">
      {[1, 2, 3, 4, 5].map((n, i) => {
        const c = distribution[String(n)] || 0;
        const pct = total > 0 ? (c / total) * 100 : 0;
        if (pct === 0) return null;
        return (
          <div
            key={n}
            style={{ width: `${pct}%`, background: shades[i] }}
            title={`${n}점: ${c}명`}
          />
        );
      })}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────
export default function SurveyPage() {
  const [tab, setTab] = useState<"form" | "results">("form");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* header */}
      <div className="border-b border-slate-900 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[9px] text-slate-500 uppercase tracking-[0.3em] mb-1">
              InsightRe
            </div>
            <div className="text-[13px] font-bold tracking-[0.2em] uppercase">
              Satisfaction Survey
            </div>
            <div className="text-[10px] text-slate-400 tracking-wider mt-0.5">
              INS 기능 만족도 설문 · 실사용자 피드백
            </div>
          </div>
          <div className="ml-auto flex items-center gap-px">
            {(
              [
                ["form", "설문 참여"],
                ["results", "결과"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-semibold border transition-colors ${
                  tab === key
                    ? "bg-white border-white text-slate-900"
                    : "bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {tab === "form" ? (
          <SurveyForm onDone={() => setTab("results")} />
        ) : (
          <ResultsView />
        )}
      </div>
    </div>
  );
}

// ─── submit form ────────────────────────────────────────────────────────────
function SurveyForm({ onDone }: { onDone: () => void }) {
  const [respondent, setRespondent] = useState("");
  const [team, setTeam] = useState("");
  const [overall, setOverall] = useState(0);
  const [recommend, setRecommend] = useState(-1);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [mostUseful, setMostUseful] = useState<string[]>([]);
  const [likes, setLikes] = useState("");
  const [improvements, setImprovements] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggleUseful = useCallback((key: string) => {
    setMostUseful((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const submit = useCallback(async () => {
    if (overall < 1) {
      setError("전체 만족도를 선택해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch(`${BASE}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondent: respondent.trim(),
          team: team.trim(),
          overall,
          recommend,
          ratings,
          most_useful: mostUseful,
          likes: likes.trim(),
          improvements: improvements.trim(),
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출 실패");
    } finally {
      setSubmitting(false);
    }
  }, [respondent, team, overall, recommend, ratings, mostUseful, likes, improvements]);

  if (done) {
    return (
      <div className="max-w-2xl border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
            제출 완료
          </span>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-[13px] text-slate-700">
            소중한 피드백 감사합니다. 응답이 저장되었습니다.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onDone}
              className="bg-[#b91c1c] hover:bg-[#991b1b] text-white text-[10px] uppercase tracking-[0.15em] font-semibold px-3 py-1.5 transition-colors"
            >
              결과 보기
            </button>
            <button
              onClick={() => window.location.reload()}
              className="border border-slate-300 text-slate-600 hover:bg-slate-50 text-[10px] uppercase tracking-[0.15em] font-semibold px-3 py-1.5 transition-colors"
            >
              새 응답 작성
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900";
  const labelCls =
    "text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700";

  return (
    <div className="max-w-3xl space-y-5">
      {/* respondent */}
      <section className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
          <span className={labelCls}>응답자</span>
          <span className="text-[10px] text-slate-400">선택 · 익명 가능</span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              이름
            </div>
            <input
              className={inputCls}
              value={respondent}
              onChange={(e) => setRespondent(e.target.value)}
              placeholder="예: 홍길동 (선택)"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              팀 / 부서
            </div>
            <input
              className={inputCls}
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="예: 재보험팀 (선택)"
            />
          </div>
        </div>
      </section>

      {/* overall */}
      <section className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
          <span className={labelCls}>전체 만족도</span>
          <span className="text-[10px] text-[#b91c1c]">필수</span>
        </div>
        <div className="p-4 flex items-center gap-4 flex-wrap">
          <RatingPicker value={overall} onChange={setOverall} />
          <span className="text-[12px] text-slate-500">
            {overall > 0 ? OVERALL_HINT[overall] : "1 (불만족) — 5 (만족)"}
          </span>
        </div>
      </section>

      {/* recommend / NPS */}
      <section className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
          <span className={labelCls}>추천 의향</span>
          <span className="text-[10px] text-slate-400">
            동료에게 추천? 0 (전혀) — 10 (적극)
          </span>
        </div>
        <div className="p-4 flex items-center gap-px flex-wrap">
          {Array.from({ length: 11 }, (_, n) => {
            const active = recommend === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRecommend(n)}
                className={`w-8 h-8 text-[11px] font-mono tabular-nums border transition-colors ${
                  active
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </section>

      {/* per-feature ratings */}
      <section className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
          <span className={labelCls}>기능별 만족도</span>
          <span className="text-[10px] text-slate-400">
            사용한 기능만 · 미사용은 제외
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {FEATURES.map((f) => (
            <div
              key={f.key}
              className="px-4 py-2.5 flex items-center justify-between gap-4"
            >
              <div>
                <div className="text-[12px] font-semibold text-slate-800 uppercase tracking-wider">
                  {f.label}
                </div>
                <div className="text-[10px] text-slate-400">{f.sub}</div>
              </div>
              <RatingPicker
                value={ratings[f.key] ?? 0}
                onChange={(v) =>
                  setRatings((prev) => ({ ...prev, [f.key]: v }))
                }
                allowNa
              />
            </div>
          ))}
        </div>
      </section>

      {/* most useful */}
      <section className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
          <span className={labelCls}>가장 유용한 기능</span>
          <span className="text-[10px] text-slate-400">복수 선택</span>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {FEATURES.map((f) => {
            const active = mostUseful.includes(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleUseful(f.key)}
                className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider border transition-colors ${
                  active
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* free text */}
      <section className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <span className={labelCls}>의견</span>
        </div>
        <div className="p-4 grid grid-cols-1 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              좋았던 점
            </div>
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={likes}
              onChange={(e) => setLikes(e.target.value)}
              placeholder="가장 도움이 된 부분은 무엇인가요?"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              개선 요청
            </div>
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="불편했던 점이나 추가되면 좋을 기능은?"
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="border border-[#b91c1c] text-[#b91c1c] text-[11px] px-4 py-3">
          오류: {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={submitting}
          className="bg-[#b91c1c] hover:bg-[#991b1b] disabled:opacity-50 text-white text-[10px] uppercase tracking-[0.15em] font-semibold px-4 py-2 transition-colors"
        >
          {submitting ? "제출 중…" : "제출하기"}
        </button>
        <span className="text-[10px] text-slate-400">
          응답은 익명으로 저장되며 개선 우선순위에만 활용됩니다.
        </span>
      </div>
    </div>
  );
}

// ─── results view ───────────────────────────────────────────────────────────
const RESULTS_KEY_STORAGE = "survey_results_key";

function ResultsView() {
  const [data, setData] = useState<Results | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const load = useCallback(async (pw: string) => {
    setLoading(true);
    setError(null);
    setAuthError(null);
    try {
      const resp = await fetch(`${BASE}/results`, {
        cache: "no-store",
        headers: { "x-survey-key": pw },
      });
      if (resp.status === 401) {
        sessionStorage.removeItem(RESULTS_KEY_STORAGE);
        setUnlocked(false);
        setAuthError("비밀번호가 올바르지 않습니다.");
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setData(await resp.json());
      setUnlocked(true);
      sessionStorage.setItem(RESULTS_KEY_STORAGE, pw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-use a key validated earlier in this browser session so switching tabs
  // doesn't re-prompt.
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? sessionStorage.getItem(RESULTS_KEY_STORAGE)
        : null;
    if (saved) load(saved);
  }, [load]);

  if (!unlocked)
    return (
      <div className="max-w-sm border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
            결과 열람 · 비밀번호
          </span>
        </div>
        <form
          className="p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (keyInput) load(keyInput);
          }}
        >
          <p className="text-[11px] text-slate-500 leading-relaxed">
            집계 결과는 담당자 전용입니다. 비밀번호를 입력하세요.
          </p>
          <input
            type="password"
            className="w-full border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="비밀번호"
            autoFocus
          />
          {authError && (
            <div className="border border-[#b91c1c] text-[#b91c1c] text-[11px] px-3 py-2">
              {authError}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !keyInput}
            className="bg-[#b91c1c] hover:bg-[#991b1b] disabled:opacity-50 text-white text-[10px] uppercase tracking-[0.15em] font-semibold px-4 py-2 transition-colors"
          >
            {loading ? "확인 중…" : "열람"}
          </button>
        </form>
      </div>
    );

  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      { label: "응답 수", sub: "Responses", value: String(data.total), hint: `갱신 ${fmtWhen(data.latest_at)}` },
      {
        label: "전체 만족도",
        sub: "Overall / 5",
        value: data.overall_avg != null ? data.overall_avg.toFixed(2) : "—",
        hint: "1–5 평균",
      },
      {
        label: "추천 의향",
        sub: "Recommend / 10",
        value: data.recommend_avg != null ? data.recommend_avg.toFixed(1) : "—",
        hint: `${data.recommend_responses}명 응답`,
      },
      {
        label: "NPS",
        sub: "Promoters − Detractors",
        value: data.nps != null ? String(data.nps) : "—",
        hint: "−100 ~ +100",
      },
    ];
  }, [data]);

  if (loading)
    return (
      <div className="min-h-[40vh] grid place-items-center text-[10px] uppercase tracking-[0.3em] text-slate-400">
        Loading…
      </div>
    );
  if (error)
    return (
      <div className="border border-[#b91c1c] text-[#b91c1c] text-[11px] px-4 py-3">
        오류: {error}
      </div>
    );
  if (!data || data.total === 0)
    return (
      <div className="border border-slate-200 bg-white p-10 text-center">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
          아직 응답이 없습니다
        </div>
        <div className="text-[11px] text-slate-400 mt-2">
          "설문 참여" 탭에서 첫 응답을 남겨 보세요.
        </div>
      </div>
    );

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                {k.label}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                {k.sub}
              </span>
            </div>
            <div className="text-[32px] font-bold font-mono tabular-nums text-slate-900 mt-1 leading-none">
              {k.value}
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-1.5">
              {k.hint}
            </div>
          </div>
        ))}
      </div>

      {/* per-feature table */}
      <div className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
            기능별 만족도
          </span>
          <span className="text-[10px] text-slate-400">평균 내림차순</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th className="text-left font-semibold px-4 py-2">기능</th>
              <th className="text-right font-semibold px-4 py-2 w-16">평균</th>
              <th className="text-right font-semibold px-4 py-2 w-16">응답</th>
              <th className="text-left font-semibold px-4 py-2 w-48">분포</th>
              <th className="text-right font-semibold px-4 py-2 w-20">유용 투표</th>
            </tr>
          </thead>
          <tbody>
            {data.features.map((f) => {
              const meta = FEATURE_LABEL[f.key];
              return (
                <tr
                  key={f.key}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">
                    <div className="text-[12px] font-semibold text-slate-800 uppercase tracking-wider">
                      {meta?.label ?? f.label}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {meta?.sub ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`text-[15px] font-mono tabular-nums font-bold ${
                        f.avg == null
                          ? "text-slate-300"
                          : f.avg >= 4
                          ? "text-emerald-700"
                          : f.avg < 3
                          ? "text-[#b91c1c]"
                          : "text-slate-900"
                      }`}
                    >
                      {f.avg != null ? f.avg.toFixed(2) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-mono tabular-nums text-slate-500">
                    {f.responses}
                  </td>
                  <td className="px-4 py-2.5">
                    {f.responses > 0 ? (
                      <MiniBar distribution={f.distribution} total={f.responses} />
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-mono tabular-nums text-slate-700">
                    {f.most_useful_votes || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* comments */}
      <div className="border border-slate-200 bg-white">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
            의견
          </span>
          <span className="text-[10px] text-slate-400">
            {data.comments.length}건 · 최신순
          </span>
        </div>
        {data.comments.length === 0 ? (
          <div className="p-6 text-[11px] text-slate-400 text-center">
            작성된 의견이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.comments.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {c.respondent || "익명"}
                  </span>
                  {c.team && (
                    <span className="text-[10px] text-slate-400">· {c.team}</span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5">
                    만족도 {c.overall}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-slate-400">
                    {fmtWhen(c.submitted_at)}
                  </span>
                </div>
                {c.likes && (
                  <p className="text-[12px] text-slate-700 leading-relaxed">
                    <span className="text-[9px] uppercase tracking-wider text-emerald-700 mr-1.5">
                      좋음
                    </span>
                    {c.likes}
                  </p>
                )}
                {c.improvements && (
                  <p className="text-[12px] text-slate-700 leading-relaxed mt-1">
                    <span className="text-[9px] uppercase tracking-wider text-[#b45309] mr-1.5">
                      개선
                    </span>
                    {c.improvements}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] font-mono text-slate-400">
        refreshed {fmtWhen(data.latest_at)} · {data.total} responses
      </div>
    </div>
  );
}
