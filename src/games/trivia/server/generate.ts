import { hashSeed, rng } from "@/lib/rng";
import { DAY_MIX, type TriviaQuestion } from "../types";

export type TriviaDay = { questions: string[] };

/**
 * Seven questions for `date` (plus `salt` for unlimited games), rising in difficulty. Unused
 * questions come first; once a difficulty runs dry, the least recently used ones return.
 * `lastUsed` maps question id -> the date it last appeared.
 */
export function generateTriviaDay(
  date: string,
  bank: TriviaQuestion[],
  lastUsed: Map<string, string>,
  salt = "",
): TriviaDay {
  const r = rng(hashSeed("trivia", date, salt));
  const chosen = new Set<string>();
  const questions: string[] = [];
  const catCount = new Map<string, number>();
  for (const diff of DAY_MIX) {
    const level = bank.filter((q) => q.diff === diff && !chosen.has(q.id));
    // At most two questions from any one category per day, unless that would force a repeat.
    const capped = level.filter((q) => (catCount.get(q.cat) ?? 0) < 2);
    const freshCapped = capped.filter((q) => !lastUsed.has(q.id));
    const fresh = freshCapped.length ? freshCapped : level.filter((q) => !lastUsed.has(q.id));
    let pick: TriviaQuestion;
    if (fresh.length) {
      pick = fresh[Math.floor(r() * fresh.length)];
    } else {
      const options = capped.length ? capped : level;
      const oldest = options
        .slice()
        .sort((a, b) => (lastUsed.get(a.id)! < lastUsed.get(b.id)! ? -1 : 1))
        .slice(0, Math.max(1, Math.floor(options.length / 4)));
      pick = oldest[Math.floor(r() * oldest.length)];
    }
    chosen.add(pick.id);
    catCount.set(pick.cat, (catCount.get(pick.cat) ?? 0) + 1);
    questions.push(pick.id);
  }
  return { questions };
}
