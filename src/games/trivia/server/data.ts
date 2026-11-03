import bank from "@/data/trivia.json";
import type { TriviaQuestion } from "../types";

/** The full trivia bank. Server-side only: answers must never reach the client early. */
export const BANK = bank as TriviaQuestion[];
const BY_ID = new Map(BANK.map((q) => [q.id, q]));

export function questionById(id: string): TriviaQuestion | undefined {
  return BY_ID.get(id);
}
