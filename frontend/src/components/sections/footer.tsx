import { ArrowUpRight } from "lucide-react";

const FAMILY_SITES = [
  {
    name: "Treasurer",
    description: "포인트가 금이 되는 공간, 트레져러",
    href: "https://www.treasurer.co.kr/",
  },
  {
    name: "Alpha Lenz",
    description: "금융 AI의 새로운 기준 · 기관급 투자 분석 LLM",
    href: "https://alpha-lenz.com/ko/landing",
  },
  {
    name: "Findle",
    description: "게임처럼 배우는 금융 교육 플랫폼",
    href: "https://findle.io",
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          {/* Brand */}
          <div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-base font-semibold tracking-tight text-navy-deep">
                Treasurer<span className="text-navy">.</span>
              </span>
              <span className="h-3.5 w-px bg-border" aria-hidden />
              <span className="text-[13px] font-semibold tracking-[0.28em] text-muted-foreground">
                ARIA
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              재보험 중개를 위한 실무형 AI 에이전트.
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">
              © {year} Treasurer Inc. · AI Reinsurance Intelligence Agent
            </p>
          </div>

          {/* Family sites — 한 줄로 */}
          <div className="lg:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-navy">
              Family Sites
            </div>
            <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
              {FAMILY_SITES.map((s, i) => (
                <li key={s.href} className="flex items-center gap-x-5">
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.description}
                    className="group inline-flex items-center gap-1 text-sm font-medium text-navy-deep transition hover:text-navy"
                  >
                    {s.name}
                    <ArrowUpRight
                      className="h-3.5 w-3.5 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-navy"
                      aria-hidden
                    />
                  </a>
                  {i < FAMILY_SITES.length - 1 && (
                    <span className="text-border" aria-hidden>
                      ·
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
