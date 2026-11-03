export type Slot = "PG" | "SG" | "SF" | "PF" | "C";
export const SLOTS: readonly Slot[] = ["PG", "SG", "SF", "PF", "C"] as const;

export type Tier = "legend" | "allstar" | "starter" | "role";

export type RatingKey = "sco" | "ply" | "reb" | "per" | "rim" | "spc";

/** One season of one player, e.g. 2016 Stephen Curry. */
export interface SFPlayer {
  /** `${pid}-${season}`, e.g. "curryst01-2016" */
  id: string;
  /** Basketball-Reference player id, e.g. "curryst01" */
  pid: string;
  /** NBA.com person id, used for the official headshot. */
  nbaId: number | null;
  name: string;
  /** Season end year (2016 = the 2015-16 season) */
  season: number;
  team: { abbr: string; name: string };
  /** Position that season, e.g. "PG" or "SF/PF" */
  pos: string;
  heightIn: number;
  tier: Tier;
  ovr: number;
  /** Decade the season started in, e.g. 2010 */
  era: number;
  /** Real per-game averages that season. null = not tracked in that era. */
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
  /** Era-relative ratings for that season, 0-99 */
  r: Record<RatingKey, number>;
  /** Share of shots by type; sums to 1 */
  shot: { rim: number; mid: number; three: number };
  /** Usage rate as a fraction */
  usg: number;
  /** Honors that season */
  acc: {
    mvp: boolean;
    dpoy: boolean;
    allStar: boolean;
    allNba: "1st" | "2nd" | "3rd" | null;
    allDef: "1st" | "2nd" | null;
    hof: boolean;
  };
  career: { allStar: number; allNba: number; mvp: number };
}

/** Player id (Basketball-Reference) from a version id like "curryst01-2016". */
export function pidOf(versionId: string): string {
  return versionId.slice(0, versionId.lastIndexOf("-"));
}

export type Lineup = Record<Slot, SFPlayer>;
