export const ROUND_LIMIT_MS = 20_000;

/** 100 for the right player, up to 100 more the faster you get it. */
export function pointsForGuess(correct: boolean, ms: number) {
  if (!correct) return { base: 0, speed: 0, total: 0 };
  const speed = Math.round(100 * Math.max(0, 1 - Math.min(ms, ROUND_LIMIT_MS) / ROUND_LIMIT_MS));
  return { base: 100, speed, total: 100 + speed };
}
