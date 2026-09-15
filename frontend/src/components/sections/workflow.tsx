import { Inbox, LanguagesIcon, Users, MailCheck } from "lucide-react";
import { SectionHeader } from "./problem";

const STEPS = [
  {
    icon: Inbox,
    label: "Step 01",
    title: "리스크 자료 수신",
    body: "국내 보험사로부터 특정 리스크 자료를 전달받습니다.",
  },
  {
    icon: LanguagesIcon,
    label: "Step 02",
    title: "영문 번역 · 핵심 요약",
    body: "ARIA가 한국어 자료를 영문으로 번역하고 핵심 정보를 자동 요약합니다.",
  },
  {
    icon: Users,
    label: "Step 03",
    title: "적합 재보험사 추천",
    body: "재보험사별 인수 선호, 담당자 정보, 커뮤니케이션 이력을 분석해 후보를 추천합니다.",
  },
  {
    icon: MailCheck,
    label: "Step 04",
    title: "맞춤 영업 이메일 초안",
    body: "재보험사별 톤·관심 리스크에 맞춘 영업 이메일 초안을 생성, 담당자가 검토 후 발송합니다.",
  },
];

export function Workflow() {
  return (
    <section id="how" className="relative border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionHeader
          eyebrow="HOW IT WORKS"
          title="국내 리스크 자료가 해외 재보험사에 도달하기까지, 4단계로 가속화"
          description="범용 챗봇과 달리, ARIA는 실제 재보험 중개 워크플로를 그대로 학습한 단계별 자동화를 제공합니다."
        />

        <div className="relative mt-16">
          <div
            className="absolute left-0 right-0 top-[2.75rem] hidden h-px bg-gradient-to-r from-transparent via-navy/30 to-transparent md:block"
            aria-hidden
          />
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.label} className="relative">
                  <div className="flex flex-col items-start">
                    <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-2xl border border-border bg-card shadow-navy">
                      <Icon className="h-7 w-7 text-navy" aria-hidden />
                    </div>
                    <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-navy">
                      {s.label}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-navy-deep">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {s.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
