import { Building2, Sparkles, LayoutGrid, ArrowUpRight } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

const SIBLING_SERVICES = [
  {
    name: "Treasurer",
    description: "포인트가 금이 되는 공간, 트레져러",
    href: "https://www.treasurer.co.kr/",
  },
  {
    name: "AlphaLenz",
    description: "금융 AI의 새로운 기준 · 기관급 투자 분석 LLM",
    href: "https://alpha-lenz.com/ko/landing",
  },
  {
    name: "Findle",
    description: "게임처럼 배우는 금융 교육 플랫폼",
    href: "https://findle.io",
  },
];

export function Contact() {
  return (
    <section id="contact" className="relative border-t border-border bg-background">
      <div className="absolute inset-0 grid-pattern opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
          <div className="lg:pr-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-navy">
              GET STARTED
            </div>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy-deep sm:text-4xl">
              ARIA 도입 또는 협업, <br /> 지금 문의해 주세요
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
              보험중개사, 법인보험대리점, 재보험 업무를 수행하는 금융기관 모두 환영합니다.
              실제 업무 환경에 맞춘 적용 시나리오와 도입 일정을 함께 논의해 드립니다.
            </p>

            <ul className="mt-8 space-y-4 text-sm">
              <Info icon={Sparkles} label="이런 분께 권장">
                중개·갱신·클레임 등 반복 업무 자동화가 필요한 실무 리더
              </Info>
              <Info icon={Building2} label="회사">
                트레져러 (Treasurer) — AI 핀테크 / 재보험 전문 AI 시스템
              </Info>
              <Info icon={LayoutGrid} label="트레져러의 다른 서비스">
                <ul className="-mx-2 mt-0.5 space-y-0.5">
                  {SIBLING_SERVICES.map((s) => (
                    <li key={s.href}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-lg px-2 py-1.5 transition hover:bg-navy/5"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-navy-deep group-hover:text-navy">
                            {s.name}
                          </span>
                          <ArrowUpRight
                            className="h-3.5 w-3.5 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-navy"
                            aria-hidden
                          />
                        </div>
                        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {s.description}
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </Info>
            </ul>
          </div>

          <ContactForm />
        </div>
      </div>
    </section>
  );
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy/8 text-navy ring-1 ring-navy/15">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-foreground">{children}</div>
      </div>
    </li>
  );
}
