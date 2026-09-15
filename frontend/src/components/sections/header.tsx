import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-semibold tracking-tight text-navy-deep">
            Treasurer<span className="text-navy">.</span>
          </span>
          <span className="h-3.5 w-px bg-border" aria-hidden />
          <span className="text-[13px] font-semibold tracking-[0.28em] text-muted-foreground">
            ARIA
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a className="transition hover:text-navy" href="#how">
            작동 방식
          </a>
          <a className="transition hover:text-navy" href="#features">
            기능
          </a>
          <a className="transition hover:text-navy" href="#security">
            보안
          </a>
        </nav>

        <a
          href="#contact"
          className={cn(
            buttonVariants({ size: "sm" }),
            "h-9 px-4 bg-navy text-white hover:bg-navy-deep",
          )}
        >
          도입 문의
        </a>
      </div>
    </header>
  );
}
