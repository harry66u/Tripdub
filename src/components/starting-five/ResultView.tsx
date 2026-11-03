"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/common/Countdown";
import { ShareButton } from "@/components/common/ShareButton";
import type { SFResult } from "@/games/starting-five/api-types";
import { formatWinProb, topPercent } from "@/games/starting-five/engine/format";
import { BoxScore } from "./BoxScore";
import { GradeBars } from "./GradeBars";
import { LineupBoard } from "./LineupBoard";

const QUARTER_MS = 620;

function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 480);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{shown}</span>;
}

function Scoreboard({ result, stage }: { result: SFResult; stage: number }) {
  const g = result.featured;
  const periods = g.home.quarters.length;
  const upTo = (q: number[]) => q.slice(0, stage).reduce((a, b) => a + b, 0);
  const done = stage >= periods;
  const won = g.home.score > g.away.score;
  const label = (i: number) => (i < 4 ? `Q${i + 1}` : periods === 5 ? "OT" : `OT${i - 3}`);
  return (
    <section className="rounded-[var(--radius-card)] border-[2.5px] border-ink bg-ink p-5 text-white shadow-[var(--shadow-pop-lg)] sm:p-7">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-sky">Your five</p>
          <CountUp value={upTo(g.home.quarters)} className="varsity tnum block text-6xl leading-none sm:text-7xl" />
        </div>
        <div className="text-center">
          {done ? (
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className={`varsity inline-block rounded-full border-[2.5px] border-white px-4 py-1 text-lg ${won ? "bg-coral" : "bg-sky-deep"}`}
            >
              {won ? "Win" : "Loss"}
            </motion.span>
          ) : (
            <span className="varsity text-sm text-sky">{label(Math.max(0, stage - 1))}</span>
          )}
          <p className="mt-2 text-xs font-semibold text-sky">{done ? (periods > 4 ? "Final, overtime" : "Final") : "Live sim"}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-sky">Mystery Five</p>
          <CountUp value={upTo(g.away.quarters)} className="varsity tnum block text-6xl leading-none sm:text-7xl" />
        </div>
      </div>
      <table className="tnum mt-5 w-full text-center text-sm">
        <thead>
          <tr className="text-xs text-sky">
            <th className="w-1/3 text-left font-semibold" />
            {g.home.quarters.map((_, i) => (
              <th key={i} className="font-semibold">
                {label(i)}
              </th>
            ))}
            <th className="font-semibold">T</th>
          </tr>
        </thead>
        <tbody>
          {(["home", "away"] as const).map((side) => (
            <tr key={side}>
              <td className="py-0.5 text-left text-sky">{side === "home" ? "You" : "Mystery"}</td>
              {g[side].quarters.map((q, i) => (
                <td key={i} className="varsity">
                  {i < stage ? q : "–"}
                </td>
              ))}
              <td className="varsity">{done ? g[side].score : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ResultView({ result, animate }: { result: SFResult; animate: boolean }) {
  const periods = result.featured.home.quarters.length;
  const [stage, setStage] = useState(animate ? 0 : periods);
  useEffect(() => {
    if (!animate) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStage(periods);
      return;
    }
    let i = 0;
    const t = setInterval(() => {
      i++;
      setStage(i);
      if (i >= periods) clearInterval(t);
    }, QUARTER_MS);
    return () => clearInterval(t);
  }, [animate, periods]);
  const done = stage >= periods;
  const reveal = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: done ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: { delay: animate ? 0.15 + i * 0.12 : 0, duration: 0.35 },
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Scoreboard result={result} stage={stage} />

      <motion.section {...reveal(0)} className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="pop rounded-[var(--radius-card)] bg-white px-6 py-4">
          <p className="text-sm font-semibold text-ink-soft">Win probability</p>
          <p className="varsity tnum text-5xl leading-tight">{formatWinProb(result.winProb)}</p>
          {result.percentile != null && result.total != null && (
            <p className="mt-1 font-bold text-coral-deep">
              {result.total < 5
                ? `You’re one of the first ${result.total} to finish today`
                : `Top ${topPercent(result.percentile)}% of ${result.total.toLocaleString()} today`}
            </p>
          )}
        </div>
        <p className="max-w-[62ch] text-lg leading-relaxed text-pretty">{result.summary}</p>
      </motion.section>

      <motion.section {...reveal(1)}>
        <h2 className="mb-3 text-xl font-extrabold">Matchups</h2>
        <p className="mb-3 text-sm text-ink-soft">The Mystery Five tonight: {result.theme}.</p>
        <LineupBoard
          clues={result.clues}
          lineup={result.lineup}
          pending={null}
          preview={null}
          busy={false}
          dragOver={null}
          onPreview={() => {}}
          onLock={() => {}}
          result={{ mystery: result.mystery, game: result.featured }}
        />
      </motion.section>

      <motion.section {...reveal(2)} className="pop rounded-[var(--radius-card)] bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-extrabold">Lineup grades</h2>
          <p className="flex items-center gap-3 text-xs font-semibold text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-full bg-coral" /> Your five
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-full bg-ink" /> Mystery Five
            </span>
          </p>
        </div>
        <GradeBars grades={result.grades} compare={result.mysteryGrades} compareLabel="Mystery Five" />
      </motion.section>

      <motion.section {...reveal(3)} className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <h2 className="text-xl font-extrabold">Box score</h2>
        <BoxScore title="Your five" lineup={result.lineup} box={result.featured.home} />
        <BoxScore title="Mystery Five" lineup={result.mystery} box={result.featured.away} />
      </motion.section>

      <motion.section
        {...reveal(4)}
        className="pop flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-sky p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div>
          <p className="text-lg font-extrabold">Share your night</p>
          <p className="text-sm">No spoilers, just the score and your grades.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ShareButton text={result.share} />
          <Countdown className="text-sm font-semibold" />
        </div>
      </motion.section>
    </div>
  );
}
