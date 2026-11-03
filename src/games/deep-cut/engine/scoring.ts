import { TIER_POINTS, type Tier } from "../types";

/** 10 points buys a foot of range: a perfect 700 is a 70-foot heave. */
export const FEET_PER_POINT = 0.1;
/** Distances from the center of the rim, in feet */
export const RIM_TO_FREE_THROW_FT = 13.75;
export const RIM_TO_THREE_FT = 23.75;
export const RIM_TO_LOGO_FT = 30;
export const RIM_TO_HALF_COURT_FT = 41.75;
export const RIM_TO_BASELINE_FT = 5.25;
export const MAX_FEET = 70;

export function pointsFor(tier: Tier | null): number {
  return tier ? TIER_POINTS[tier] : 0;
}

export function feetFor(points: number): number {
  return Math.round(points * FEET_PER_POINT * 10) / 10;
}

const ZONES = [
  { from: 0, label: "At the rim" },
  { from: 4, label: "In the paint" },
  { from: RIM_TO_FREE_THROW_FT, label: "Midrange" },
  { from: RIM_TO_THREE_FT, label: "Three-point range" },
  { from: RIM_TO_LOGO_FT, label: "Logo range" },
  { from: RIM_TO_HALF_COURT_FT, label: "Past half-court" },
];

export function zoneFor(feet: number): { label: string } {
  let z = ZONES[0];
  for (const zone of ZONES) if (feet >= zone.from) z = zone;
  return { label: z.label };
}
