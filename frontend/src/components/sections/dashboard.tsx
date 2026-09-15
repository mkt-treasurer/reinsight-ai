import { CheckCircle2, TrendingUp, ClipboardList, AlertTriangle, BarChart3 } from "lucide-react";

const BENEFITS = [
  {
    icon: ClipboardList,
    title: "파이프라인",
    body: "각 계약의 진행 상태와 담당자별 파이프라인을 한눈에",
  },
  {
    icon: AlertTriangle,
    title: "갱신·클레임",
    body: "갱신 일정·클레임 현황·정산·청산 상태 통합 가시화",
  },
  {
    icon: TrendingUp,
    title: "매출 포캐스트",
    body: "올해 예상 매출 및 포캐스트 자동 집계",
  },
  {
    icon: BarChart3,
    title: "데이터 기반 의사결정",
    body: "경험·수작업 의존 → 데이터 기반 관리 체계로 전환",
  },
];

export function Dashboard() {
  return (
    <section className="relative border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-navy">
              OPERATIONS DASHBOARD
            </div>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy-deep sm:text-4xl">
              관리자에게는 운영을 한눈에 보여주는 데이터 컨트롤 타워
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
              ARIA는 실무자 도구일 뿐만 아니라, 보험중개사 경영진이 영업 현황과 리스크를
              데이터로 판단할 수 있는 운영 대시보드를 제공합니다.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <li
                  key={b.title}
                  className="rounded-2xl border border-border bg-card p-5 transition hover:shadow-navy hover:border-navy/30"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/8 text-navy ring-1 ring-navy/15">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="text-sm font-semibold tracking-tight text-navy-deep">
                      {b.title}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Re-export CheckCircle2 if anywhere imports it from here (kept for backwards safety)
export { CheckCircle2 };
