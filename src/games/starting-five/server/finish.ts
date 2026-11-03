import { hashSeed } from "@/lib/rng";
import { puzzleNumber } from "@/lib/day";
import { SLOTS, type Lineup, type Slot } from "../types";
import { clueFor, type Clue } from "../engine/archetype";
import { gradeLineup, type Grades } from "../engine/grades";
import { replay, RunError, type Action } from "../engine/run";
import { shareText } from "../engine/share";
import { evaluateMatchup, type GameResult } from "../engine/sim";
import { summarize } from "../engine/summary";
import { playerById, POOL } from "./data";
import { generateSFPuzzle, type SFPuzzle } from "./generate";
import { getSFPuzzle } from "./puzzle";

export type Mode = "daily" | "unlimited";

export type RunToken = {
  v: 2;
  mode: Mode;
  date: string;
  /** Random per unlimited game; "" for the daily */
  salt: string;
  /** Hash of the puzzle the run was dealt, so edits to the schedule can't change a run midway */
  ph: number;
  device: string;
  /** Random per run, so every run's tokens are unique */
  rid: string;
  actions: Action[];
};

export type SFResult = {
  mode: Mode;
  date: string;
  /** Daily puzzle number; null in unlimited */
  puzzleNumber: number | null;
  theme: string;
  lineup: Lineup;
  opponent: Lineup;
  clues: Record<Slot, Clue>;
  grades: Grades;
  opponentGrades: Grades;
  winProb: number;
  meanMargin: number;
  featured: GameResult;
  summary: string;
  percentile: number | null;
  total: number | null;
  share: string;
};

export function runPuzzle(t: Pick<RunToken, "mode" | "date" | "salt">): SFPuzzle {
  return t.mode === "daily" ? getSFPuzzle(t.date) : generateSFPuzzle(t.date, POOL, new Set(), t.salt);
}

export function puzzleHash(p: SFPuzzle): number {
  return hashSeed(p.theme, ...p.spins, ...SLOTS.map((s) => p.mystery[s]));
}

export function lineupFromIds(ids: Partial<Record<Slot, string>>): Lineup {
  return Object.fromEntries(
    SLOTS.map((s) => {
      const p = ids[s] && playerById(ids[s]!);
      if (!p) throw new RunError(`Unknown player in ${s}`);
      return [s, p];
    }),
  ) as Lineup;
}

export function opponentClues(opponent: Lineup): Record<Slot, Clue> {
  return Object.fromEntries(SLOTS.map((s) => [s, clueFor(opponent[s])])) as Record<Slot, Clue>;
}

/** The first handful of finishers don't get a percentile: "Top 1%" of one player means nothing. */
export function rankFor(rank: { percentile: number; total: number } | null): { percentile: number | null; total: number | null } {
  if (!rank) return { percentile: null, total: null };
  return { percentile: rank.total >= 5 ? rank.percentile : null, total: rank.total };
}

/** Score a finished run. Pure: the same token always produces the same result. */
export function finishRun(token: RunToken): SFResult {
  const puzzle = runPuzzle(token);
  if (puzzleHash(puzzle) !== token.ph) throw new RunError("This puzzle was updated. Reload to start it fresh.");
  const view = replay(puzzle.spins, token.actions);
  if (!view.done) throw new RunError("Fill all five slots before you play");
  const lineup = lineupFromIds(view.lineup);
  const opponent = lineupFromIds(puzzle.mystery);
  const seed = hashSeed("sf-eval", token.date, token.salt, ...SLOTS.map((s) => lineup[s].id));
  const ev = evaluateMatchup(lineup, opponent, seed);
  const grades = gradeLineup(Object.values(lineup));
  const n = token.mode === "daily" ? puzzleNumber(token.date) : null;
  return {
    mode: token.mode,
    date: token.date,
    puzzleNumber: n,
    theme: puzzle.theme,
    lineup,
    opponent,
    clues: opponentClues(opponent),
    grades,
    opponentGrades: gradeLineup(Object.values(opponent)),
    winProb: ev.winProb,
    meanMargin: ev.meanMargin,
    featured: ev.featured,
    summary: summarize(ev, lineup, opponent, { home: "your five", away: `the ${puzzle.theme}` }),
    percentile: null,
    total: null,
    share: shareFor(n, puzzle.theme, ev.featured, ev.winProb, grades, null),
  };
}

export function shareFor(
  puzzleNumber: number | null,
  theme: string,
  g: GameResult,
  winProb: number,
  grades: Grades,
  percentile: number | null,
): string {
  return shareText({
    puzzleNumber,
    opponent: theme,
    won: g.home.score > g.away.score,
    homeScore: g.home.score,
    awayScore: g.away.score,
    winProb,
    grades,
    percentile,
  });
}
