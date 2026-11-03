import { hashSeed, rng, shuffle } from "@/lib/rng";
import type { ShotChart } from "../types";

export type ShotRound = { chart: string; choices: string[] };
export type ShotDay = { rounds: ShotRound[] };

const group = (pos: string) => (pos.includes("C") ? "C" : pos.includes("F") ? "F" : "G");

/**
 * Five rounds for `date` (plus `salt` for unlimited games): tier 1 (a star season) to tier 5 (a deep
 * cut). Wrong choices are real players from the same era, position group and a nearby tier, so the
 * answer can't be picked out by elimination. `recentPids` sit out as answers.
 */
export function generateShotDay(
  date: string,
  charts: ShotChart[],
  recentPids: Set<string>,
  salt = "",
  usedCharts: Set<string> = new Set(),
): ShotDay {
  const r = rng(hashSeed("shot", date, salt));
  const usedPids = new Set<string>();
  const rounds: ShotRound[] = [];
  for (let tier = 1; tier <= 5; tier++) {
    const eligible = charts.filter((c) => c.tier === tier && c.pid && !recentPids.has(c.pid) && !usedPids.has(c.pid));
    let pool = eligible.filter((c) => !usedCharts.has(c.id)); // never-shown charts first
    if (!pool.length) pool = eligible;
    if (!pool.length) pool = charts.filter((c) => c.tier === tier && c.pid && !usedPids.has(c.pid));
    const answer = pool[Math.floor(r() * pool.length)];
    usedPids.add(answer.pid!);
    const near = (c: ShotChart, spread: number, sameGroup: boolean) =>
      c.pid !== answer.pid &&
      !usedPids.has(c.pid!) &&
      Math.abs(c.season - answer.season) <= 3 &&
      Math.abs(c.tier - tier) <= spread &&
      (!sameGroup || group(c.pos) === group(answer.pos));
    let options = charts.filter((c) => near(c, 1, true));
    if (options.length < 3) options = charts.filter((c) => near(c, 2, false));
    const picked: ShotChart[] = [];
    for (const c of shuffle(options, r)) {
      if (picked.length === 3) break;
      if (!picked.some((p) => p.pid === c.pid)) picked.push(c);
    }
    rounds.push({ chart: answer.id, choices: shuffle([answer, ...picked], r).map((c) => c.id) });
  }
  return { rounds };
}
