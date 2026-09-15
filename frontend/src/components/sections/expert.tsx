import Image from "next/image";
import { Quote } from "lucide-react";

export function Expert() {
  return (
    <section className="relative border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-14 shadow-navy sm:px-14 sm:py-16">
          <div
            className="absolute inset-0 grid-pattern opacity-60 [mask-image:radial-gradient(ellipse_at_30%_50%,black,transparent_70%)]"
            aria-hidden
          />
          <div className="absolute -top-32 -right-24 h-72 w-72 rounded-full bg-navy/8 blur-3xl" aria-hidden />

          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-navy">
                BUILT WITH INDUSTRY EXPERTS
              </div>
              <Quote className="mt-5 h-7 w-7 text-navy/60" aria-hidden />
              <blockquote className="mt-3 text-balance text-2xl font-medium leading-relaxed tracking-tight text-navy-deep sm:text-[26px] sm:leading-snug">
                “ARIA는 중개사의 판단과 네트워크를 <span className="text-navy">대체</span>하는 것이 아니라,
                실무자가 더 빠르게 시장에 접근하고 더 많은 시간을
                <span className="text-navy"> 고부가가치 영업과 리스크 판단</span>에
                쓸 수 있도록 돕는 실무형 AI 에이전트입니다.”
              </blockquote>
              <div className="mt-7 flex items-center gap-4">
                <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-navy">
                  <Image
                    src="/aria/kim-yoonbae.jpg"
                    alt="김윤배 이사 프로필 사진"
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <div className="font-semibold tracking-tight text-navy-deep">김윤배 이사</div>
                  <div className="text-sm text-muted-foreground">
                    트레져러 · <span className="text-foreground/80">윌리스타워스왓슨 출신</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-2xl border border-border bg-secondary/40 p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-navy">
                  실무 경험
                </div>
                <ul className="mt-4 space-y-3 text-sm text-foreground">
                  <li className="flex gap-2">
                    <span className="text-navy">·</span> 기업보험 · 재보험 중개 실무
                  </li>
                  <li className="flex gap-2">
                    <span className="text-navy">·</span> 국내 보험사–해외 재보험사 커뮤니케이션
                  </li>
                  <li className="flex gap-2">
                    <span className="text-navy">·</span> 리스크 분석 · 슬립 작성
                  </li>
                  <li className="flex gap-2">
                    <span className="text-navy">·</span> 갱신 관리 · 클레임 대응
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
