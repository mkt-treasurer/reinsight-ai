import { FilesIcon, LanguagesIcon, CalendarClockIcon } from "lucide-react";

const PROBLEMS = [
  {
    icon: FilesIcon,
    title: "분산된 문서, 흩어진 데이터",
    body: "이메일, 엑셀, PDF, 워드, 슬립, 갱신 자료, 클레임 자료가 담당자별·채널별로 흩어져 관리되어 효율과 데이터 축적 모두 어렵습니다.",
  },
  {
    icon: LanguagesIcon,
    title: "반복되는 번역·요약·이메일 작성",
    body: "국내 리스크 자료를 영문으로 정리하고, 재보험사별로 맞춤 이메일을 작성하는 일이 매 건마다 수작업으로 반복됩니다.",
  },
  {
    icon: CalendarClockIcon,
    title: "수작업에 의존하는 갱신·클레임",
    body: "계약 갱신 일정, 클레임 대응, 정산·청산 상태가 개별 담당자의 경험과 엑셀에 의존해 누락·지연 리스크가 큽니다.",
  },
];

export function Problem() {
  return (
    <section className="relative border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionHeader
          eyebrow="WHY ARIA"
          title="재보험 중개 업무는 전문성이 높지만, 현장은 반복 업무로 가득합니다"
          description="국내 보험사·해외 재보험사·브로커·기업 고객 등 다양한 이해관계자가 얽히고, 이메일·엑셀·PDF가 분산 관리되는 현실의 비효율을 ARIA가 정면으로 해결합니다."
        />
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PROBLEMS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="group rounded-2xl border border-border bg-card p-6 transition shadow-sm hover:shadow-navy hover:border-navy/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy/8 text-navy ring-1 ring-navy/15">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-navy-deep">
                  {p.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-navy">{eyebrow}</div>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy-deep sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
