"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { VarsityThree } from "@/components/brand/VarsityThree";
import { Countdown } from "@/components/common/Countdown";
import { ShareButton } from "@/components/common/ShareButton";
import { puzzleDate, puzzleNumber } from "@/lib/day";
import { combinedShare } from "@/lib/client/combined-share";
import { allProgress, GAME_KEYS, isTripdub, streaks, type DayProgress, type GameKey } from "@/lib/client/progress";
import { LogoLockup } from "@/components/brand/Logo";
import { GameIcon, type GameIconName } from "@/components/brand/GameIcon";
import { DeepCutFeature, ShotChartPreview, StartingFivePreview, TriviaPreview } from "./Previews";

type GameCard = { key: GameKey; title: string; href: string; blurb: string; icon: GameIconName };

const FEATURED: GameCard = {
  key: "deep",
  title: "Deep Cut",
  href: "/deep-cut",
  icon: "deep",
  blurb: "Seven prompts, endless right answers. The rarer the player you name, the deeper your shot.",
};
const MORE: GameCard[] = [
  { key: "sf", title: "Starting Five", href: "/starting-five", icon: "sf", blurb: "Spin five real seasons. Beat tonight’s five." },
  { key: "trivia", title: "NBA Trivia", href: "/trivia", icon: "trivia", blurb: "Seven quick questions. Speed scores." },
  { key: "shot", title: "Shot Chart", href: "/shot-chart", icon: "shot", blurb: "Five real shot charts. Name the player." },
];

function Status({ done, compact }: { done?: { summary: string }; compact?: boolean }) {
  return done ? (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="truncate">{compact ? "Done" : `Done: ${done.summary}`}</span>
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-butter-soft px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">{compact ? "Ready" : "Today’s puzzle is ready"}</span>
  );
}

function Buttons({ card, done, archive, short }: { card: GameCard; done: boolean; archive?: boolean; short?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={card.href} className="btn btn-coral btn-sm">
        {done ? (short ? "Result" : "See today’s result") : short ? "Play today’s" : "Play today’s game"}
      </Link>
      <Link href={`${card.href}?mode=unlimited`} className="btn btn-white btn-sm">
        Unlimited
      </Link>
      {archive && (
        <Link href={`${card.href}?mode=archive`} className="btn btn-white btn-sm">
          Archive
        </Link>
      )}
      <span className="text-xs font-bold whitespace-nowrap text-ink-soft/70" title="1v1 is coming soon">
        1v1 soon
      </span>
    </div>
  );
}

function Confetti() {
  const colors = ["var(--color-coral)", "var(--color-sky)", "var(--color-butter)", "var(--color-mint)"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-3 w-2 rounded-sm border border-ink"
          style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length] }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: 260, rotate: (i % 2 ? 1 : -1) * 260, opacity: 0 }}
          transition={{ duration: 1.6 + (i % 5) * 0.2, delay: (i % 7) * 0.06, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

export function HomeDashboard() {
  const [day, setDay] = useState<DayProgress>({});
  const [streak, setStreak] = useState({ current: 0, tripdubs: 0 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => {
      const all = allProgress();
      setDay(all[puzzleDate()] ?? {});
      setStreak(streaks(all));
      setReady(true);
    };
    refresh();
    window.addEventListener("tripdub:progress", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("tripdub:progress", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const doneCount = GAME_KEYS.filter((g) => day[g]).length;
  const tripdub = isTripdub(day);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 pb-2 sm:px-6">
      <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <LogoLockup className="w-20 shrink-0" arcId="home-arc" />
          <div>
            <h1 className="text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">Four daily hoops games</h1>
            <p className="text-sm font-medium text-ink-soft">New puzzles every midnight ET</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-bold">
          <span className="flex gap-1" aria-label={`${doneCount} of ${GAME_KEYS.length} daily games done`}>
            {GAME_KEYS.map((g) => (
              <span key={g} className={`h-3.5 w-3.5 rounded-full border-[2.5px] border-ink ${day[g] ? "bg-coral" : "bg-white"}`} />
            ))}
          </span>
          <span>{ready ? `${doneCount}/${GAME_KEYS.length} today` : "Today"}</span>
          <span className="rounded-full bg-white px-2.5 py-0.5 ring-2 ring-ink">
            Streak <span className="varsity">{streak.current}</span>
          </span>
          {streak.tripdubs > 0 && (
            <span className="rounded-full bg-butter px-2.5 py-0.5 ring-2 ring-ink">
              Tripdubs <span className="varsity">{streak.tripdubs}</span>
            </span>
          )}
          <Countdown className="text-sm font-semibold text-ink-soft" />
        </div>
      </section>

      {tripdub && (
        <motion.section
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="pop relative mt-3 flex flex-col items-start gap-3 overflow-hidden rounded-[var(--radius-card)] bg-butter p-4 sm:flex-row sm:items-center"
        >
          <Confetti />
          <VarsityThree className="h-14 w-14 shrink-0" />
          <div className="flex-1">
            <p className="text-xl font-extrabold">That’s a Tripdub.</p>
            <p className="text-sm font-semibold">All four daily games done. Come back tomorrow to keep the streak going.</p>
          </div>
          <ShareButton text={combinedShare(puzzleNumber(puzzleDate()), day)} label="Share your Tripdub" />
        </motion.section>
      )}

      <section className="pop mt-3 grid overflow-hidden rounded-[28px] bg-white md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5 p-5">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span className="varsity rounded-full bg-coral px-2 py-0.5 text-[11px] tracking-wider text-white">NEW</span>
            <span className="text-coral-deep">Featured game</span>
            <Status done={day[FEATURED.key]} />
          </p>
          <div>
            <h2 className="flex items-center gap-2 text-[2.1rem] leading-none font-extrabold tracking-tight sm:text-[2.4rem]">
              <GameIcon name={FEATURED.icon} className="h-7 w-7 text-coral-deep" />
              {FEATURED.title}
            </h2>
            <p className="mt-2 max-w-md text-[15px] leading-snug text-ink-soft">{FEATURED.blurb}</p>
          </div>
          <Buttons card={FEATURED} done={!!day[FEATURED.key]} archive />
        </div>
        <div className="relative hidden min-h-44 border-l-[2.5px] border-ink md:block">
          <DeepCutFeature />
        </div>
      </section>

      <div className="mt-3 grid gap-3 md:grid-cols-3 md:gap-4">
        {MORE.map((card) => (
          <section key={card.key} className="pop flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-white">
            <Link href={card.href} className="block h-16 overflow-hidden border-b-[2.5px] border-ink bg-sky" tabIndex={-1} aria-hidden>
              {card.key === "sf" ? <StartingFivePreview /> : card.key === "trivia" ? <TriviaPreview /> : <ShotChartPreview />}
            </Link>
            <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <h2 className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight">
                  <GameIcon name={card.icon} className="h-5 w-5 text-coral-deep" />
                  {card.title}
                </h2>
                <Status done={day[card.key]} compact />
              </div>
              <p className="text-sm leading-snug text-ink-soft">{card.blurb}</p>
              <div className="mt-auto pt-1.5">
                <Buttons card={card} done={!!day[card.key]} short />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
