"use client";

import { addDays, puzzleDate } from "@/lib/day";
import { load, save } from "./storage";

export type GameKey = "sf" | "trivia" | "shot" | "deep";
export const GAME_KEYS: GameKey[] = ["sf", "trivia", "shot", "deep"];
export type DayProgress = Partial<Record<GameKey, { summary: string; share: string }>>;

const KEY = "tripdub:progress:v1";

export function allProgress(): Record<string, DayProgress> {
  return load<Record<string, DayProgress>>(KEY) ?? {};
}

/** Record a finished daily game (unlimited games don't count toward streaks). */
export function markDailyDone(game: GameKey, date: string, summary: string, share: string) {
  const all = allProgress();
  all[date] = { ...all[date], [game]: { summary, share } };
  save(KEY, all);
  window.dispatchEvent(new Event("tripdub:progress"));
}

export function isTripdub(day: DayProgress | undefined): boolean {
  return !!day && GAME_KEYS.every((g) => day[g]);
}

/** Consecutive days with at least one daily game, ending today (or yesterday if today isn't played yet). */
export function streaks(all = allProgress(), today = puzzleDate()) {
  const played = (d: string) => !!all[d] && GAME_KEYS.some((g) => all[d][g]);
  let start = played(today) ? today : addDays(today, -1);
  let current = 0;
  while (played(start)) {
    current++;
    start = addDays(start, -1);
  }
  const tripdubs = Object.values(all).filter(isTripdub).length;
  return { current, tripdubs };
}
