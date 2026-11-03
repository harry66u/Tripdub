export const ZONES = ["ra", "paint", "mid_lb", "mid_lw", "mid_c", "mid_rw", "mid_rb", "c3_l", "c3_r", "atb_l", "atb_c", "atb_r"] as const;
export type ZoneId = (typeof ZONES)[number];
export type MadeAttempted = [number, number];

export interface ShotChart {
  /** `${pid}-${season}` */
  id: string;
  pid: string | null;
  nbaId: number;
  name: string;
  /** Season end year */
  season: number;
  team: { abbr: string; name: string };
  pos: string;
  fga: number;
  fgm: number;
  zones: Record<ZoneId, MadeAttempted>;
  line: { pts: number | null; reb: number | null; ast: number | null };
  allStar: boolean;
  fame: number;
  /** 1 = star season .. 5 = deep cut */
  tier: 1 | 2 | 3 | 4 | 5;
}

/** What the player sees during a round: the chart, never the name or season. */
export interface ServedRound {
  index: number;
  total: number;
  zones: Record<ZoneId, MadeAttempted>;
  league: Record<ZoneId, MadeAttempted>;
  fga: number;
  fgm: number;
  tier: number;
  choices: string[];
}

export const ROUNDS_PER_DAY = 5;
