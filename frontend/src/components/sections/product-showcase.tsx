import Image from "next/image";

export function ProductShowcase() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 pb-20 sm:pb-24">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-navy">
            INSIDE ARIA
          </div>
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            ARIA의 운영 대시보드 — 파이프라인, 갱신, 클레임, 매출 포캐스트를 한 화면에서.
          </p>
        </div>

        <div className="relative mt-10">
          {/* Soft glow behind */}
          <div
            className="absolute -inset-x-8 -top-8 -bottom-8 bg-gradient-to-br from-navy/8 via-transparent to-azure/8 blur-3xl"
            aria-hidden
          />

          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-navy-lg">
            {/* Browser chrome */}
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.16_28)]" aria-hidden />
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.82_0.13_85)]" aria-hidden />
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.70_0.14_150)]" aria-hidden />
              </div>
              <div className="hidden text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
                ARIA · Reinsurance Operations Desk
              </div>
              <div className="text-[11px] text-muted-foreground">LIVE</div>
            </div>

            <Image
              src="/aria/product/operations.png"
              alt="ARIA 운영 대시보드 — KPI, 파이프라인, Reinsurer Exposure, Attention Queue"
              width={2880}
              height={1620}
              priority
              sizes="(max-width: 1280px) 100vw, 1200px"
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
