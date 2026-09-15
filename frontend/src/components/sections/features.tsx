import {
  FileText,
  Target,
  Mail,
  FileSignature,
  CalendarCheck2,
  ShieldAlert,
  Wallet,
  LineChart,
} from "lucide-react";
import { SectionHeader } from "./problem";

const FEATURES = [
  {
    icon: FileText,
    title: "리스크 정보 요약·번역",
    body: "국문·영문 리스크 자료를 양방향으로 번역하고 핵심 정보를 구조화해 요약합니다.",
  },
  {
    icon: Target,
    title: "재보험사 인수 선호도 분석",
    body: "재보험사별 인수 선호와 리스크 애피타이트를 데이터화해 적합도 높은 후보를 추천합니다.",
  },
  {
    icon: Mail,
    title: "맞춤 영업 이메일 초안",
    body: "재보험사 담당자·기존 커뮤니케이션 이력 기반으로 톤·맥락에 맞는 영업 이메일을 작성합니다.",
  },
  {
    icon: FileSignature,
    title: "슬립 작성 지원",
    body: "표준 슬립 양식에 맞춰 자료를 정리·검증해 작성 시간을 단축합니다.",
  },
  {
    icon: CalendarCheck2,
    title: "계약 갱신 일정 관리",
    body: "갱신 시점, 우선순위, 담당자별 진행 상황을 한 곳에서 추적합니다.",
  },
  {
    icon: ShieldAlert,
    title: "클레임 관리",
    body: "클레임 접수·처리 상태·필요 자료를 자동 정리해 대응 속도와 품질을 높입니다.",
  },
  {
    icon: Wallet,
    title: "정산·청산 관리",
    body: "정산·청산 상태를 가시화하고 누락 항목을 자동 알림으로 관리합니다.",
  },
  {
    icon: LineChart,
    title: "파이프라인·매출 포캐스트",
    body: "담당자별 파이프라인, 갱신 가능성, 예상 수익을 대시보드로 한눈에 확인합니다.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionHeader
          eyebrow="CORE CAPABILITIES"
          title="재보험 실무의 8가지 핵심 업무, AI로 가속합니다"
          description="ARIA는 단순한 자동화 도구가 아닙니다. AI와 RPA 기술을 결합해 재보험 중개의 전 업무 흐름을 일관되게 지원합니다."
        />

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-navy sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative bg-card p-6 transition hover:bg-secondary/60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/8 text-navy ring-1 ring-navy/15">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-[15px] font-semibold tracking-tight text-navy-deep">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
