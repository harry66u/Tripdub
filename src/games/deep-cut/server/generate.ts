import { hashSeed, rng } from "@/lib/rng";
import { GENERAL_PER_DAY, SPECIFIC_PER_DAY, type DCPrompt } from "../types";

export type DCDay = { prompts: string[] };

/** How many prompts of one family a day can hold: big families (team-decades) get more slots. */
export function familyCap(familySize: number, poolSize: number, slots: number): number {
  return Math.max(1, Math.ceil((familySize / poolSize) * slots));
}

/**
 * Seven prompts for `date` (plus `salt` for unlimited games): three general and four specific,
 * spread across difficulty and ordered easier to harder. Never two prompts about the same team or
 * star in a day, and families are capped by size. Unused prompts come first (the family cap bends
 * by one before a prompt repeats); once a kind runs dry, the least recently used return.
 * `lastUsed` maps prompt id -> the date it last appeared.
 */
export function generateDeepCutDay(date: string, bank: DCPrompt[], lastUsed: Map<string, string>, salt = "", avoid: string[] = []): DCDay {
  const r = rng(hashSeed("deepcut", date, salt));
  const chosen: DCPrompt[] = [];
  const ids = new Set(avoid);
  const fams = new Map<string, number>();
  const tags = new Set<string>();
  let cap = new Map<string, number>();
  const free = (p: DCPrompt) => !ids.has(p.id) && !p.tags.some((t) => tags.has(t));
  const ok = (p: DCPrompt, slack = 0) => free(p) && (fams.get(p.fam) ?? 0) < (cap.get(p.fam) ?? 1) + slack;
  const fresh = (p: DCPrompt) => !lastUsed.has(p.id);
  const any = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const leastRecent = (xs: DCPrompt[]) => {
    const sorted = xs.slice().sort((a, b) => (lastUsed.get(a.id)! < lastUsed.get(b.id)! ? -1 : lastUsed.get(a.id)! > lastUsed.get(b.id)! ? 1 : 0));
    return any(sorted.slice(0, Math.max(1, Math.floor(sorted.length / 4))));
  };

  for (const [kind, count] of [["general", GENERAL_PER_DAY], ["specific", SPECIFIC_PER_DAY]] as const) {
    const pool = bank.filter((p) => p.kind === kind).sort((a, b) => a.ease - b.ease || (a.id < b.id ? -1 : 1));
    const band = new Map(pool.map((p, i) => [p.id, Math.floor((i * count) / pool.length)]));
    const sizes = new Map<string, number>();
    for (const p of pool) sizes.set(p.fam, (sizes.get(p.fam) ?? 0) + 1);
    cap = new Map([...sizes].map(([f, n]) => [f, familyCap(n, pool.length, count)]));
    for (let b = 0; b < count; b++) {
      const okAll = pool.filter((p) => ok(p));
      const inBand = okAll.filter((p) => band.get(p.id) === b);
      const freshBand = inBand.filter(fresh);
      const freshAll = okAll.filter(fresh);
      const freshBent = pool.filter((p) => ok(p, 1) && fresh(p));
      const fallback = inBand.length ? inBand : okAll.length ? okAll : pool.filter(free);
      if (!fallback.length && !freshBent.length) break;
      const pick = freshBand.length ? any(freshBand) : freshAll.length ? any(freshAll) : freshBent.length ? any(freshBent) : leastRecent(fallback);
      chosen.push(pick);
      ids.add(pick.id);
      fams.set(pick.fam, (fams.get(pick.fam) ?? 0) + 1);
      for (const t of pick.tags) tags.add(t);
    }
  }
  chosen.sort((a, b) => b.ease - a.ease || (a.kind === b.kind ? 0 : a.kind === "general" ? -1 : 1));
  return { prompts: chosen.map((p) => p.id) };
}
