"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { GameIcon, type GameIconName } from "@/components/brand/GameIcon";

export const GAMES: { href: string; label: string; short: string; icon: GameIconName }[] = [
  { href: "/deep-cut", label: "Deep Cut", short: "Deep Cut", icon: "deep" },
  { href: "/starting-five", label: "Starting Five", short: "Starting 5", icon: "sf" },
  { href: "/trivia", label: "NBA Trivia", short: "Trivia", icon: "trivia" },
  { href: "/shot-chart", label: "Shot Chart", short: "Shot Chart", icon: "shot" },
];

export function SiteHeader() {
  const path = usePathname() ?? "/";
  const on = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <header className="sticky top-0 z-30 border-b-[2.5px] border-ink bg-sky">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:h-16 sm:px-6">
        <Link href="/" className="shrink-0 rounded-lg focus-visible:ring-4 focus-visible:ring-white" aria-label="Tripdub home">
          <LogoMark className="h-9 w-auto md:h-10" />
        </Link>
        <nav aria-label="Games" className="ml-auto hidden items-center gap-0.5 rounded-full border-[2.5px] border-ink bg-white p-1 shadow-[var(--shadow-pop-sm)] md:flex">
          {GAMES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              aria-current={on(g.href) ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap transition-colors lg:px-3.5 ${
                on(g.href) ? "bg-ink text-white" : "text-ink hover:bg-sky-soft"
              }`}
            >
              <GameIcon name={g.icon} className={`h-4 w-4 ${on(g.href) ? "text-butter" : "text-coral-deep"}`} />
              {g.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/about"
          aria-current={on("/about") ? "page" : undefined}
          className={`ml-auto flex h-10 items-center gap-1.5 rounded-full border-[2.5px] border-ink px-2.5 text-sm font-bold shadow-[var(--shadow-pop-sm)] transition-colors md:ml-0 lg:px-3.5 ${
            on("/about") ? "bg-ink text-white" : "bg-white text-ink hover:bg-sky-soft"
          }`}
          aria-label="How it works"
        >
          <span className={`varsity grid h-5 w-5 place-items-center rounded-full text-xs ${on("/about") ? "bg-butter text-ink" : "bg-ink text-white"}`}>?</span>
          <span className="hidden lg:inline">How it works</span>
        </Link>
      </div>
      {/* Phones: every game one tap away */}
      <nav aria-label="Games" className="mx-auto grid max-w-6xl grid-cols-4 gap-1 px-2 pb-2 md:hidden">
        {GAMES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            aria-current={on(g.href) ? "page" : undefined}
            className={`flex items-center justify-center gap-1 rounded-full border-2 py-1 text-[11px] font-bold whitespace-nowrap ${
              on(g.href) ? "border-ink bg-ink text-white" : "border-ink/20 bg-white/70 text-ink"
            }`}
          >
            <GameIcon name={g.icon} className={`h-3.5 w-3.5 shrink-0 ${on(g.href) ? "text-butter" : "text-coral-deep"}`} />
            {g.short}
          </Link>
        ))}
      </nav>
    </header>
  );
}
