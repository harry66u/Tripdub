import { hashSeed, rng, shuffle, weightedIndex } from "@/lib/rng";
import { puzzleNumber } from "@/lib/day";
import { SLOTS, type SFPlayer, type Slot, type Tier } from "../types";

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
  { name: "Splash Era", filter: (p) => star(p) && p.era >= 2010, weight: (p) => 1 + p.r.spc / 50 },
  { name: "Twin Towers", filter: (p) => star(p), weight: (p) => 1 + p.r.rim / 40 },
  { name: "Showtime Speed", filter: (p) => star(p) && p.era === 1980, weight: (p) => 1 + (p.r.ply + p.r.sco) / 100 },
  { name: "Defense Wins", filter: (p) => star(p) && Math.max(p.r.per, p.r.rim) >= 80 },
  { name: "Old School", filter: (p) => star(p) && p.era <= 1970 },
  { name: "Positionless", filter: (p) => star(p) && p.era >= 2000, weight: (p) => 1 + p.ovr / 50 },
];

const SPIN_TIER_WEIGHTS: Record<Tier, number> = { legend: 0.15, allstar: 0.35, starter: 0.38, role: 0.12 };
/** How likely each tier is to make a Mystery Five (themes then filter by era and style). */
const MYSTERY_TIER_WEIGHTS: Record<Tier, number> = { legend: 0.5, allstar: 1, starter: 0.8, role: 0 };
const TIERS: Tier[] = ["legend", "allstar", "starter", "role"];

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
  const chosen = new Set<string>();
  const out = {} as Record<Slot, string>;
  const candidates = pool.filter(theme.filter);
  // Fill the hardest slots first so scarce positions get a real fit.
  const order = SLOTS.slice().sort(
    (a, b) => candidates.filter((p) => fits(p, a)).length - candidates.filter((p) => fits(p, b)).length,
  );
  for (const slot of order) {
    let options = candidates.filter((p) => fits(p, slot) && !chosen.has(p.id));
    if (theme.name === "Twin Towers" && (slot === "PF" || slot === "C")) {
      const towers = options.filter((p) => p.r.rim >= 85);
      if (towers.length) options = towers;
    }
    if (!options.length) options = candidates.filter((p) => !chosen.has(p.id));
    if (!options.length || options.every((p) => MYSTERY_TIER_WEIGHTS[p.tier] === 0)) {
      options = pool.filter((p) => star(p) && !chosen.has(p.id));
    }
    const w = options.map((p) => (theme.weight?.(p) ?? 1) * MYSTERY_TIER_WEIGHTS[p.tier]);
    const p = options[weightedIndex(w, r)];
    chosen.add(p.id);
    out[slot] = p.id;
  }
  return out;
}

/**
 * The daily puzzle for `date`: deterministic from the date, avoiding players spun recently.
 */
export function generateSFPuzzle(
  date: string,
  pool: SFPlayer[],
  recentSpinIds: Set<string>,
  salt = "",
): SFPuzzle {
  const r = rng(hashSeed("sf", date, salt));
  const theme = themeFor(date);
  const mystery = pickMystery(theme, pool, r);
  const taken = new Set<string>([...Object.values(mystery), ...recentSpinIds]);
  const spins: string[] = [];
  while (spins.length < 6) {
    let tier = TIERS[weightedIndex(TIERS.map((t) => SPIN_TIER_WEIGHTS[t]), r)];
    let options = pool.filter((p) => p.tier === tier && !taken.has(p.id));
    if (!options.length) {
      options = pool.filter((p) => !taken.has(p.id));
      tier = options[0]?.tier ?? tier;
    }
    if (!options.length) throw new Error(`Player pool exhausted on ${date}`);
    const p = options[Math.floor(r() * options.length)];
    taken.add(p.id);
    spins.push(p.id);
  }
  return { spins, mystery, theme: theme.name };
}
