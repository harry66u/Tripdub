import { hashSeed } from "@/lib/rng";
import { puzzleNumber } from "@/lib/day";
import { SLOTS, type Lineup, type Slot } from "../types";
import { clueFor, type Clue } from "../engine/archetype";
import { gradeLineup, type Grades } from "../engine/grades";
import { replay, RunError, type Action } from "../engine/run";
import { shareText } from "../engine/share";
import { evaluateMatchup, type GameResult } from "../engine/sim";
import { summarize } from "../engine/summary";
import { playerById } from "./data";
import { getSFPuzzle } from "./puzzle";

export type RunToken = { v: 1; date: string; device: string; actions: Action[] };

export type SFResult = {
  date: string;
  puzzleNumber: number;
  theme: string;
  lineup: Lineup;
  mystery: Lineup;
  clues: Record<Slot, Clue>;
  grades: Grades;
  mysteryGrades: Grades;
  winProb: number;
  meanMargin: number;
  featured: GameResult;
  summary: string;
  percentile: number | null;
  total: number | null;
  share: string;
};

export function lineupFromIds(ids: Partial<Record<Slot, string>>): Lineup {
  return Object.fromEntries(
    SLOTS.map((s) => {
      const p = ids[s] && playerById(ids[s]!);
      if (!p) throw new RunError(`Unknown player in ${s}`);
      return [s, p];
    }),
  ) as Lineup;
}

export function mysteryClues(mystery: Lineup): Record<Slot, Clue> {
  return Object.fromEntries(SLOTS.map((s) => [s, clueFor(mystery[s])])) as Record<Slot, Clue>;
}

/** Score a finished daily run. Pure: the same token always produces the same result. */
export function finishRun(token: RunToken): SFResult {
  const puzzle = getSFPuzzle(token.date);
  const view = replay(puzzle.spins, token.actions);
  if (!view.done) throw new RunError("Fill all five slots before you simulate");
  const lineup = lineupFromIds(view.lineup);
  const mystery = lineupFromIds(puzzle.mystery);
  const ev = evaluateMatchup(lineup, mystery, hashSeed("sf-eval", token.date, ...SLOTS.map((s) => lineup[s].id)));
  const grades = gradeLineup(Object.values(lineup));
  const won = ev.featured.home.score > ev.featured.away.score;
  const n = puzzleNumber(token.date);
  return {
    date: token.date,
    puzzleNumber: n,
    theme: puzzle.theme,
    lineup,
    mystery,
    clues: mysteryClues(mystery),
    grades,
    mysteryGrades: gradeLineup(Object.values(mystery)),
    winProb: ev.winProb,
    meanMargin: ev.meanMargin,
    featured: ev.featured,
    summary: summarize(ev, lineup, mystery, { home: "your five", away: "the Mystery Five" }),
    percentile: null,
    total: null,
    share: shareText({
      puzzleNumber: n,
      won,
      homeScore: ev.featured.home.score,
      awayScore: ev.featured.away.score,
      winProb: ev.winProb,
      grades,
      percentile: null,
    }),
  };
}
