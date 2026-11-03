export const TIME_LIMIT_MS = 15_000;
/** Below this many answers, a question's "% correct" isn't shown or scored. */
export const MIN_ANSWERS_FOR_PCT = 20;

export type Points = { base: number; speed: number; rarity: number; total: number };

/**
 * 100 for a correct answer, up to 100 more for speed (linear to zero at the buzzer), and up to 75
 * more when most players missed it.
 */
export function pointsFor({ correct, ms, pct }: { correct: boolean; ms: number; pct: number | null }): Points {
  if (!correct) return { base: 0, speed: 0, rarity: 0, total: 0 };
  const speed = Math.round(100 * Math.max(0, 1 - Math.min(ms, TIME_LIMIT_MS) / TIME_LIMIT_MS));
  const rarity = pct == null ? 0 : Math.round(75 * (1 - Math.min(1, Math.max(0, pct))) + 1e-9);
  return { base: 100, speed, rarity, total: 100 + speed + rarity };
}
