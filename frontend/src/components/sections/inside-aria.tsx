import Image from "next/image";
import { Bot, FileSearch, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "./problem";

type Feature = {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  image: { src: string; alt: string };
  reverse?: boolean;
};

const FEATURES: Feature[] = [
  {
    icon: Bot,
    eyebrow: "AI AGENT",
    title: "자연어로 묻고, ARIA가 데이터에서 직접 답합니다",
    description:
      "재보험사별 보험료 합계, 미결 클레임 상위 N건, 종목별 추이 — 흩어진 데이터를 한 줄 질문으로 추출합니다. ReAct 기반 에이전트가 필요한 툴을 스스로 호출해 답을 찾을 때까지 반복합니다.",
    bullets: [
      "도구를 자율적으로 호출하는 ReAct 에이전트",
      "자주 묻는 질문은 원클릭 프롬프트로 제공",
      "조회·집계·분석을 자연어 한 줄로",
    ],
    image: {
      src: "/aria/product/ai-agent.png",
      alt: "ARIA AI Agent — 재보험 데이터에 자연어로 질의하는 화면",
    },
  },
  {
    icon: FileSearch,
    eyebrow: "DOCUMENTS",
    title: "이메일·PDF·슬립이 자동으로 정리·파싱됩니다",
    description:
      "Cover Note, Signed Slip, Booking 시트, Premium 시트가 들어오는 즉시 분류·파싱되어 계약·정책 데이터와 자동으로 매칭됩니다. 미부킹·미정산 문서는 별도 큐로 즉시 가시화됩니다.",
    bullets: [
      "Cover Note·Signed Slip·Premium 시트 자동 분류",
      "계약·정책과 자동 매칭, 미매칭 건은 알림 큐로",
      "파싱 상태·만료·중복까지 한눈에",
    ],
    image: {
      src: "/aria/product/documents.png",
      alt: "ARIA Documents — 재보험 문서 파싱·매칭 화면",
    },
    reverse: true,
  },
];

export function InsideAria() {
  return (
    <section id="inside" className="relative border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionHeader
          eyebrow="PRODUCT TOUR"
          title="실제로 ARIA는 이렇게 동작합니다"
          description="복잡한 재보험 실무를 단순한 두 가지 인터페이스로 — 묻고 답하는 AI 에이전트, 그리고 자동 정리되는 문서 큐."
        />

        <div className="mt-16 space-y-20 sm:space-y-24">
          {FEATURES.map((f) => (
            <FeatureRow key={f.eyebrow} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <div
      className={`grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14 ${
        feature.reverse ? "lg:[&>*:first-child]:order-2" : ""
      }`}
    >
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-navy/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-navy ring-1 ring-navy/15">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {feature.eyebrow}
        </div>
        <h3 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-navy-deep sm:text-3xl">
          {feature.title}
        </h3>
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
        <ul className="mt-6 space-y-2.5">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-navy" aria-hidden />
              <span className="text-foreground">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <ProductFrame src={feature.image.src} alt={feature.image.alt} />
    </div>
  );
}

function ProductFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative">
      <div
        className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-navy/8 via-transparent to-azure/8 blur-2xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-navy-lg">
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.16_28)]" aria-hidden />
          <span className="h-2 w-2 rounded-full bg-[oklch(0.82_0.13_85)]" aria-hidden />
          <span className="h-2 w-2 rounded-full bg-[oklch(0.70_0.14_150)]" aria-hidden />
        </div>
        <Image
          src={src}
          alt={alt}
          width={2400}
          height={1500}
          sizes="(max-width: 1024px) 100vw, 600px"
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}
