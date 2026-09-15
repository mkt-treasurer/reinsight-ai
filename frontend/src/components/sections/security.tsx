import { ShieldCheck, KeyRound, History, MailCheck } from "lucide-react";
import { SectionHeader } from "./problem";

const SECURITY = [
  {
    icon: KeyRound,
    title: "내부 문서 접근 권한 관리",
    body: "역할·팀·계약 단위 권한으로 민감한 자료의 접근을 정밀하게 통제합니다.",
  },
  {
    icon: ShieldCheck,
    title: "고객 정보 보호",
    body: "고객 식별 정보·계약 데이터에 대한 암호화와 마스킹을 단계적으로 적용합니다.",
  },
  {
    icon: History,
    title: "계약 데이터 이력 관리",
    body: "변경 이력과 처리 주체를 자동 기록해 감사·내부 통제에 대응합니다.",
  },
  {
    icon: MailCheck,
    title: "이메일 발송 승인·이력",
    body: "외부 발송 이메일은 승인 절차와 발송 이력 관리로 컴플라이언스를 확보합니다.",
  },
];

export function Security() {
  return (
    <section id="security" className="relative border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionHeader
          eyebrow="SECURITY & COMPLIANCE"
          title="보험업 특성에 맞춘 보안과 컴플라이언스, 단계적으로 강화합니다"
          description="ARIA는 중개사가 실제로 필요로 하는 보안 통제를 단계적으로 적용합니다. 권한 관리부터 발송 이력까지, 신뢰할 수 있는 운영 환경을 제공합니다."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-navy/30 hover:shadow-navy"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy/8 text-navy ring-1 ring-navy/15">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-[15px] font-semibold tracking-tight text-navy-deep">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
