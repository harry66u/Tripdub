"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { SFResult } from "@/games/starting-five/api-types";
import type { Play } from "@/games/starting-five/engine/sim";
import type { Lineup } from "@/games/starting-five/types";

const RIM = ["finishes at the rim", "throws it down", "lays it in", "scores inside"];
const MID = ["hits a jumper", "knocks down a pull-up", "drills a midrange J", "fades away and scores"];
const THREE = ["drains a three", "splashes a triple", "buries one from deep", "hits from downtown"];

function pick(list: string[], p: Play) {
  return list[(p.q * 31 + p.t * 7 + p.h + p.a) % list.length];
}

export function describePlay(p: Play, home: Lineup, away: Lineup): string {
  const mine = p.side === "home" ? home : away;
  const theirs = p.side === "home" ? away : home;
  const who = mine[p.slot].name;
  const other = p.other ? (p.kind === "block" || p.kind === "steal" ? theirs[p.other].name : mine[p.other].name) : null;
  switch (p.kind) {
    case "three":
      return `${who} ${pick(THREE, p)}${other ? ` (assist: ${other})` : ""}`;
    case "mid":
      return `${who} ${pick(MID, p)}${other ? ` (assist: ${other})` : ""}`;
    case "rim":
      return `${who} ${pick(RIM, p)}${other ? ` (assist: ${other})` : ""}`;
    case "ft":
      return p.pts ? `${who} makes ${p.pts} at the line` : `${who} misses at the line`;
    case "block":
      return `${who} blocks ${other}!`;
    case "steal":
      return `${who} picks off ${other}`;
  }
}

const clock = (p: Play) => `${p.q <= 4 ? `Q${p.q}` : p.q === 5 ? "OT" : `OT${p.q - 4}`} ${Math.floor(p.t / 60)}:${String(p.t % 60).padStart(2, "0")}`;

/** The featured game, replayed play by play like a 2K sim. */
export function LiveSim({ result, onDone }: { result: SFResult; onDone: () => void }) {
  const plays = result.featured.plays ?? [];
  const [i, setI] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!plays.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doneRef.current();
      return;
    }
    const step = Math.max(28, Math.min(90, 14000 / plays.length));
    const t = setInterval(() => {
      setI((x) => {
        if (x + 1 >= plays.length) {
          clearInterval(t);
          setTimeout(() => doneRef.current(), 700);
          return plays.length;
        }
        return x + 1;
      });
    }, step);
    return () => clearInterval(t);
  }, [plays.length]);
  const cur = plays[Math.min(i, plays.length - 1)];
  const recent = plays.slice(Math.max(0, i - 6), i + 1).reverse();
  return (
    <section className="rounded-[var(--radius-card)] border-[2.5px] border-ink bg-ink p-5 text-white shadow-[var(--shadow-pop-lg)] sm:p-7">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <div>
          <p className="text-sm font-semibold text-sky">Your five</p>
          <p className="varsity tnum text-5xl leading-none sm:text-7xl">{cur?.h ?? 0}</p>
        </div>
        <div className="text-center">
          <span className="varsity rounded-full border-2 border-white px-3 py-1 text-sm">{cur ? clock(cur) : "Q1 12:00"}</span>
          <p className="mt-2 text-xs font-semibold text-sky">Live sim</p>
        </div>
        <div className="text-right">
          <p className="truncate text-sm font-semibold text-sky">{result.theme}</p>
          <p className="varsity tnum text-5xl leading-none sm:text-7xl">{cur?.a ?? 0}</p>
        </div>
      </div>
      <ul className="mt-5 grid gap-1.5" aria-live="polite">
        <AnimatePresence initial={false}>
          {recent.map((p, k) => (
            <motion.li
              key={`${p.q}-${p.t}-${p.h}-${p.a}-${p.kind}-${p.slot}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: k === 0 ? 1 : 0.6 - k * 0.07, x: 0 }}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.side === "home" ? "bg-coral" : "bg-sky"}`} />
              <span className="tnum shrink-0 text-xs text-sky">{clock(p)}</span>
              <span className="truncate font-semibold">{describePlay(p, result.lineup, result.opponent)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <button type="button" className="btn btn-white mt-5 px-4 py-1.5 text-sm" onClick={() => doneRef.current()}>
        Skip to final
      </button>
    </section>
  );
}
