export const TIERS = ["layup", "toocute", "midrange", "three", "logo", "halfcourt"] as const;
export type Tier = (typeof TIERS)[number];

/** Shot range: rarer answers score more. A perfect day is 7 half-court shots, 700 points. */
export const TIER_POINTS: Record<Tier, number> = { layup: 10, toocute: 15, midrange: 30, three: 60, logo: 85, halfcourt: 100 };
export const TIER_LABEL: Record<Tier, string> = {
  layup: "Layup",
  toocute: "Too Cute",
  midrange: "Midrange",
  three: "Three",
  logo: "Logo Shot",
  halfcourt: "Half-Court",
};
export const TIER_BLURB: Record<Tier, string> = {
  layup: "The one everybody says.",
  toocute: "Felt clever. Everyone else thought of it too.",
  midrange: "Solid. Not everyone gets there.",
  three: "From deep. Few people go here.",
  logo: "Way out there. A real deep cut.",
  halfcourt: "From half-court. Hand-picked, and you knew it.",
};

export interface DCPrompt {
  id: string;
  text: string;
  /** Fine print: what counts */
  note: string;
  kind: "general" | "specific";
  /** Prompt family, so one day doesn't get two of the same kind */
  fam: string;
  /** Teams or stars the prompt is about, so one day doesn't ask about the same team twice */
  tags: string[];
  /** How many well-known answers exist: higher is easier */
  ease: number;
  /** Every valid answer (Basketball-Reference id) and its tier. Server-side only. */
  answers: Record<string, Tier>;
}

/** A player the typed-answer matcher knows: id, label, career years, fame, aliases */
export interface DCName {
  i: string;
  n: string;
  y: string;
  f?: number;
  a?: string[];
}

/** What the player sees while answering */
export interface ServedPrompt {
  id: string;
  text: string;
  note: string;
  kind: "general" | "specific";
  /** How many valid answers there are */
  count: number;
}

export const PROMPTS_PER_DAY = 7;
export const GENERAL_PER_DAY = 3;
export const SPECIFIC_PER_DAY = 4;
export const TIME_LIMIT_MS = 25_000;
export const MAX_SCORE = PROMPTS_PER_DAY * TIER_POINTS.halfcourt;
