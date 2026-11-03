export type Slot = "PG" | "SG" | "SF" | "PF" | "C";
export const SLOTS: readonly Slot[] = ["PG", "SG", "SF", "PF", "C"] as const;

export type Tier = "legend" | "allstar" | "starter" | "role";

export type RatingKey = "sco" | "ply" | "reb" | "per" | "rim" | "spc";

export interface SFPlayer {
  /** Basketball-Reference player id, e.g. "jordami01" */
  id: string;
  /** NBA.com person id, used for the official headshot. */
  nbaId: number | null;
  name: string;
  /** Natural position label, e.g. "PG" or "SF/PF" */
  pos: string;
  heightIn: number;
  /** Prime seasons, as season end years (1996 = 1995-96) */
  prime: { from: number; to: number };
  tier: Tier;
  ovr: number;
  /** Decade of the prime midpoint, e.g. 1990 */
  era: number;
  /** Real per-game averages over the prime. null = not tracked in that era. */
  line: {
    pts: number | null;
    reb: number | null;
    ast: number | null;
    stl: number | null;
    blk: number | null;
    fg3Pct: number | null;
    fg3a: number | null;
    ftPct: number | null;
    tsPct: number | null;
  };
  /** Era-relative ratings, 0-99 */
  r: Record<RatingKey, number>;
  /** Share of shots by type; sums to 1 */
  shot: { rim: number; mid: number; three: number };
  /** Usage rate as a fraction */
  usg: number;
  acc: { mvp: number; allStar: number; allNba: number; allDef: number; dpoy: number; hof: boolean };
}

export type Lineup = Record<Slot, SFPlayer>;
