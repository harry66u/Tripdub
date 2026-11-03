import players from "@/data/sf-players.json";
import type { SFPlayer } from "../types";

/** The full Starting Five pool. Server-side only: never import from a client component. */
export const POOL = players as SFPlayer[];

const BY_ID = new Map(POOL.map((p) => [p.id, p]));

export function playerById(id: string): SFPlayer | undefined {
  return BY_ID.get(id);
}

export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_NAME = new Map<string, SFPlayer[]>();
for (const p of POOL) {
  const k = normalizeName(p.name);
  BY_NAME.set(k, [...(BY_NAME.get(k) ?? []), p]);
}

/**
 * Look up a version by id ("curryst01-2016"), "2016 Stephen Curry", "Stephen Curry 2016", or just
 * "Stephen Curry" (his best season). Case- and accent-insensitive.
 */
export function findPlayer(query: string): SFPlayer | undefined {
  const q = query.trim();
  if (BY_ID.has(q)) return BY_ID.get(q);
  const m = q.match(/^(\d{4})\s+(.+)$/) ?? q.match(/^(.+?)\s+(\d{4})$/);
  const [year, name] = m ? (/^\d{4}$/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]]) : [null, q];
  const versions = BY_NAME.get(normalizeName(name)) ?? [];
  if (year != null) return versions.find((v) => v.season === year);
  return versions.slice().sort((a, b) => b.ovr - a.ovr)[0];
}
