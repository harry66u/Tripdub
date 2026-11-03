import { hashSeed, rng, shuffle, weightedIndex } from "@/lib/rng";
import { puzzleNumber } from "@/lib/day";
import { pidOf, SLOTS, type SFPlayer, type Slot, type Tier } from "../types";

export type SFPuzzle = { spins: string[]; mystery: Record<Slot, string>; theme: string };

type Theme = {
  name: string;
  /** Who can be on this Mystery Five */
  filter: (p: SFPlayer) => boolean;
  /** Extra selection weight */
  weight?: (p: SFPlayer) => number;
};

const star = (p: SFPlayer) => p.tier !== "role";

export const THEMES: Theme[] = [
  { name: "All-Time Legends", filter: (p) => p.tier === "legend", weight: () => 2 },
  { name: "90s Bruisers", filter: (p) => star(p) && p.era === 1990, weight: (p) => 1 + (p.r.reb + p.r.per) / 100 },
  { name: "Splash Squad", filter: (p) => star(p) && p.era >= 2010, weight: (p) => 1 + p.r.spc / 50 },
  { name: "Twin Towers", filter: (p) => star(p), weight: (p) => 1 + p.r.rim / 40 },
  { name: "Showtime", filter: (p) => star(p) && p.era === 1980, weight: (p) => 1 + (p.r.ply + p.r.sco) / 100 },
  { name: "Lockdown Crew", filter: (p) => star(p) && Math.max(p.r.per, p.r.rim) >= 80 },
  { name: "New Wave", filter: (p) => star(p) && p.season >= 2018, weight: (p) => 1 + p.ovr / 60 },
  { name: "Positionless Five", filter: (p) => star(p) && p.era >= 2000, weight: (p) => 1 + p.ovr / 50 },
];

const SPIN_TIER_WEIGHTS: Record<Tier, number> = { legend: 0.15, allstar: 0.35, starter: 0.38, role: 0.12 };
/** How likely each tier is to make the opposing five (themes then filter by era and style). */
const MYSTERY_TIER_WEIGHTS: Record<Tier, number> = { legend: 0.8, allstar: 1, starter: 0.45, role: 0 };
const TIERS: Tier[] = ["legend", "allstar", "starter", "role"];

/** Spins lean modern: most players should be ones people watched. */
export function eraWeight(season: number): number {
  if (season >= 2015) return 1;
  if (season >= 2005) return 0.9;
  if (season >= 1995) return 0.45;
  if (season >= 1985) return 0.25;
  if (season >= 1980) return 0.12;
  return 0.08;
}

/** Does a player's natural position cover this slot? "SF/PF" covers SF and PF; "G" covers guards. */
export function fits(p: SFPlayer, slot: Slot): boolean {
  return p.pos.split("/").includes(slot);
}

export function themeFor(date: string): Theme {
  // Cycle through every theme once per 8 days, in an order shuffled per cycle.
  const n = puzzleNumber(date) - 1;
  const cycle = Math.floor(n / THEMES.length);
  const order = shuffle(THEMES, rng(hashSeed("sf-theme-cycle", cycle)));
  return order[((n % THEMES.length) + THEMES.length) % THEMES.length];
}

function pickMystery(theme: Theme, pool: SFPlayer[], r: () => number): Record<Slot, string> {
  const chosen = new Set<string>(); // player ids: one version per player
  const out = {} as Record<Slot, string>;
  const candidates = pool.filter(theme.filter);
  // Fill the hardest slots first so scarce positions get a real fit.
  const order = SLOTS.slice().sort(
    (a, b) => candidates.filter((p) => fits(p, a)).length - candidates.filter((p) => fits(p, b)).length,
  );
  for (const slot of order) {
    let options = candidates.filter((p) => fits(p, slot) && !chosen.has(p.pid));
    if (theme.name === "Twin Towers" && (slot === "PF" || slot === "C")) {
      const towers = options.filter((p) => p.r.rim >= 85);
      if (towers.length) options = towers;
    }
    if (!options.length) options = candidates.filter((p) => !chosen.has(p.pid));
    if (!options.length || options.every((p) => MYSTERY_TIER_WEIGHTS[p.tier] === 0)) {
      options = pool.filter((p) => star(p) && !chosen.has(p.pid));
    }
    // The opposing five is on screen from the start, so favor names people know.
    const w = options.map(
      (p) =>
        (theme.weight?.(p) ?? 1) *
        MYSTERY_TIER_WEIGHTS[p.tier] *
        (p.career.allStar > 0 ? 1 : 0.25) *
        eraWeight(p.season),
    );
    const p = options[weightedIndex(w, r)];
    chosen.add(p.pid);
    out[slot] = p.id;
  }
  return out;
}

/**
 * The puzzle for `date` (plus `salt` for unlimited games): deterministic, and no player appears
 * twice in one day. `recentPids` are players spun recently, who sit this one out.
 */
export function generateSFPuzzle(date: string, pool: SFPlayer[], recentPids: Set<string>, salt = ""): SFPuzzle {
  const r = rng(hashSeed("sf", date, salt));
  const theme = salt ? THEMES[Math.floor(r() * THEMES.length)] : themeFor(date);
  const mystery = pickMystery(theme, pool, r);
  const taken = new Set<string>([...Object.values(mystery).map(pidOf), ...recentPids]);
  const spins: string[] = [];
  while (spins.length < 6) {
    const tier = TIERS[weightedIndex(TIERS.map((t) => SPIN_TIER_WEIGHTS[t]), r)];
    let options = pool.filter((p) => p.tier === tier && !taken.has(p.pid));
    if (!options.length) options = pool.filter((p) => !taken.has(p.pid));
    if (!options.length) throw new Error(`Player pool exhausted on ${date}`);
    const p = options[weightedIndex(options.map((o) => eraWeight(o.season)), r)];
    taken.add(p.pid);
    spins.push(p.id);
  }
  return { spins, mystery, theme: theme.name };
}
