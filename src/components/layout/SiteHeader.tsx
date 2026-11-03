import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-[2.5px] border-ink bg-sky">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Tripdub home">
          <LogoMark className="h-10 w-auto" />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
          <Link href="/starting-five" className="hidden rounded-full px-3 py-2 hover:bg-white/50 md:inline">
            Starting Five
          </Link>
          <Link href="/trivia" className="hidden rounded-full px-3 py-2 hover:bg-white/50 md:inline">
            NBA Trivia
          </Link>
          <Link href="/shot-chart" className="hidden rounded-full px-3 py-2 hover:bg-white/50 md:inline">
            Shot Chart
          </Link>
          <Link href="/deep-cut" className="hidden rounded-full px-3 py-2 hover:bg-white/50 md:inline">
            Deep Cut
          </Link>
          <Link href="/about" className="rounded-full px-3 py-2 hover:bg-white/50">
            How it works
          </Link>
        </nav>
      </div>
    </header>
  );
}
