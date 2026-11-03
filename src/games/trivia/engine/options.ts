import { rng, shuffle } from "@/lib/rng";
import type { ServedQuestion, TriviaQuestion } from "../types";

/** Shuffle the four options for this player and game; returns where the right answer landed. */
export function serveQuestion(q: TriviaQuestion, seed: number): { served: ServedQuestion; options: string[]; correctIndex: number } {
  const order = shuffle([0, 1, 2, 3], rng(seed));
  const options = order.map((i) => q.a[i]);
  return {
    served: { id: q.id, q: q.q, options, cat: q.cat, diff: q.diff },
    options,
    correctIndex: order.indexOf(0),
  };
}
