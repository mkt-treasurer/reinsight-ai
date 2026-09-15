import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-navy/20 to-transparent" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-28 sm:pt-32 sm:pb-36">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-1.5 text-xs font-medium tracking-wider text-navy backdrop-blur shadow-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            <span className="uppercase">AI Reinsurance Intelligence Agent</span>
          </div>

          <h1 className="mt-7 max-w-4xl text-balance text-4xl font-semibold tracking-tight text-navy-deep sm:text-5xl md:text-6xl">
            재보험 중개 특화 <br className="hidden sm:block" />
            <span className="bg-gradient-to-br from-[var(--navy-deep)] via-[var(--navy)] to-[var(--navy-soft)] bg-clip-text text-transparent">
              AI 에이전트, ARIA
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            리스크 요약·번역부터 영업 이메일 작성, 슬립 작성, 계약·클레임 관리까지.
            범용 챗봇과 차별화된 재보험 특화 AI 시스템이 중개사의 반복 업무를 자동화합니다.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#contact"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-6 text-base bg-navy text-white hover:bg-navy-deep shadow-navy-lg",
              )}
            >
              도입 문의하기 <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#features"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-12 px-6 text-base bg-white border-border text-navy hover:bg-white hover:text-navy-deep",
              )}
            >
              주요 기능 살펴보기
            </a>
          </div>

          <dl className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-6 border-t border-border pt-10 sm:grid-cols-3">
            <Stat value="8+" label="재보험 실무 자동화 기능" />
            <Stat value="100%" label="국내·해외 재보험 문서 다국어 지원" />
            <Stat value="3+" label="국내외 재보험 중개사 출신 자문진" />
          </dl>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <dt className="text-2xl font-semibold tracking-tight sm:text-3xl">
        <span className="text-navy-deep">{value}</span>
      </dt>
      <dd className="mt-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dd>
    </div>
  );
}
