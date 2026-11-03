"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { VarsityThree } from "@/components/brand/VarsityThree";
import { Countdown } from "@/components/common/Countdown";
import { ShareButton } from "@/components/common/ShareButton";
import { puzzleDate, puzzleNumber } from "@/lib/day";
import { combinedShare } from "@/lib/client/combined-share";
import { allProgress, isTripdub, streaks, type DayProgress, type GameKey } from "@/lib/client/progress";

type GameCard = { key: GameKey; title: string; href: string; blurb: string };

const SF: GameCard = {
  key: "sf",
  title: "Starting Five",
  href: "/starting-five",
  blurb: "Spin for five real NBA seasons, slot each player into a matchup, and take on tonight’s opposing five.",
};
const MORE: GameCard[] = [
  { key: "trivia", title: "NBA Trivia", href: "/trivia", blurb: "Seven questions built from the record books. The faster you answer, the more you score." },
  { key: "shot", title: "Shot Chart", href: "/shot-chart", blurb: "Five real shot charts, from a star season to a deep cut. Name the player." },
];

function Status({ done }: { done?: { summary: string } }) {
  return done ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-sm font-bold">
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
        <path d="M3 8.5l3 3 7-7" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Done today: {done.summary}
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-butter-soft px-3 py-1 text-sm font-bold">Today’s puzzle is waiting</span>
  );
}

function Buttons({ card, done }: { card: GameCard; done: boolean }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Link href={card.href} className="btn btn-coral">
        {done ? "See today’s result" : "Play today’s game"}
      </Link>
      <Link href={`${card.href}?mode=unlimited`} className="btn btn-white">
        Unlimited
      </Link>
      <span className="btn btn-white cursor-not-allowed opacity-55" aria-disabled title="1v1 is coming soon">
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
  const doneCount = (["sf", "trivia", "shot"] as const).filter((g) => day[g]).length;
  const tripdub = isTripdub(day);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-label={`${doneCount} of 3 daily games done`}>
            {(["sf", "trivia", "shot"] as const).map((g) => (
              <span key={g} className={`h-4 w-4 rounded-full border-[2.5px] border-ink ${day[g] ? "bg-coral" : "bg-white"}`} />
            ))}
          </div>
          <p className="text-sm font-bold">
            {ready ? `${doneCount}/3 today` : "Today"}
            <span className="ml-3 rounded-full bg-white px-2.5 py-1 text-ink shadow-[var(--shadow-pop-sm)] ring-2 ring-ink">
              Streak <span className="varsity">{streak.current}</span>
            </span>
            {streak.tripdubs > 0 && (
              <span className="ml-2 rounded-full bg-butter px-2.5 py-1 shadow-[var(--shadow-pop-sm)] ring-2 ring-ink">
                Tripdubs <span className="varsity">{streak.tripdubs}</span>
              </span>
            )}
          </p>
        </div>
        <Countdown className="text-sm font-semibold" />
      </div>

      {tripdub && (
        <motion.section
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="pop relative mt-5 flex flex-col items-start gap-4 overflow-hidden rounded-[var(--radius-card)] bg-butter p-5 sm:flex-row sm:items-center sm:p-6"
        >
          <Confetti />
          <VarsityThree className="h-20 w-20 shrink-0" />
          <div className="flex-1">
            <p className="text-2xl font-extrabold">That’s a Tripdub.</p>
            <p className="font-semibold">All three daily games done. Come back tomorrow to keep the streak going.</p>
          </div>
          <ShareButton text={combinedShare(puzzleNumber(puzzleDate()), day)} label="Share your Tripdub" />
        </motion.section>
      )}

      <section className="pop mt-5 grid overflow-hidden rounded-[32px] bg-white sm:grid-cols-[1.1fr_1fr]">
        <div className="p-6 sm:p-8">
          <p className="text-sm font-bold text-coral-deep">Featured</p>
          <h2 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{SF.title}</h2>
          <p className="mt-3 max-w-md text-lg text-ink-soft">{SF.blurb}</p>
          <div className="mt-4">
            <Status done={day.sf} />
          </div>
          <Buttons card={SF} done={!!day.sf} />
        </div>
        <div className="relative hidden min-h-56 border-l-[2.5px] border-ink bg-sky sm:block" aria-hidden>
          <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
            <g fill="none" stroke="#fff" strokeWidth="4" opacity="0.8">
              <path d="M40 300 V200 A160 160 0 0 1 360 200 V300" />
              <rect x="140" y="150" width="120" height="150" />
              <circle cx="200" cy="150" r="40" />
            </g>
            {["PG", "SG", "SF", "PF", "C"].map((slot, i) => {
              const [x, y] = [[200, 70], [330, 130], [70, 130], [290, 230], [110, 230]][i];
              return (
                <g key={slot}>
                  <circle cx={x + 3} cy={y + 4} r="30" fill="var(--color-ink)" />
                  <circle cx={x} cy={y} r="30" fill="#fff" stroke="var(--color-ink)" strokeWidth="4" />
                  <text x={x} y={y + 7} textAnchor="middle" fontSize="20" fill="var(--color-ink)" style={{ fontFamily: "var(--font-display)" }}>
                    {slot}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {MORE.map((card) => (
          <section key={card.key} className="pop rounded-[var(--radius-card)] bg-white p-6">
            <h2 className="text-3xl font-extrabold tracking-tight">{card.title}</h2>
            <p className="mt-2 text-ink-soft">{card.blurb}</p>
            <div className="mt-4">
              <Status done={day[card.key]} />
            </div>
            <Buttons card={card} done={!!day[card.key]} />
          </section>
        ))}
      </div>
    </div>
  );
}
