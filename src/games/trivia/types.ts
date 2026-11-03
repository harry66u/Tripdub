export type Difficulty = "easy" | "medium" | "hard";

export interface TriviaQuestion {
  id: string;
  q: string;
  /** a[0] is the correct answer */
  a: [string, string, string, string] | string[];
  cat: string;
  diff: Difficulty;
}

/** What the player sees: options shuffled, no hint of which is right. */
export interface ServedQuestion {
  id: string;
  q: string;
  options: string[];
  cat: string;
  diff: Difficulty;
}

export const QUESTIONS_PER_DAY = 7;
export const DAY_MIX: Difficulty[] = ["easy", "easy", "medium", "medium", "medium", "hard", "hard"];
