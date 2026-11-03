import "server-only";
import { createHash } from "node:crypto";
import { addDays, isValidDate, puzzleDate } from "@/lib/day";
import { hashSeed } from "@/lib/rng";
import { signToken, verifyToken } from "@/lib/server/token";
import { runSecret } from "@/lib/server/http";
import { serveQuestion } from "../engine/options";
import { QUESTIONS_PER_DAY } from "../types";
import { questionById } from "./data";
import { getTriviaDay, getTriviaUnlimited } from "./puzzle";

export type TriviaAnswer = { c: number | null; ms: number; pts: number; ok: boolean };

export type TriviaToken = {
  v: 1;
  mode: "daily" | "unlimited";
  date: string;
  salt: string;
  device: string;
  /** Random per run, so every run's tokens are unique */
  rid: string;
  /** Index of the current question */
  i: number;
  /** When the current question was served (ms epoch); null between questions */
  at: number | null;
  res: TriviaAnswer[];
};

/** Network and render time we don't charge to the player. */
export const LATENCY_ALLOWANCE_MS = 300;

export function issueTriviaToken(t: TriviaToken): string {
  return signToken(t, runSecret());
}

export function readTriviaToken(token: unknown): TriviaToken | null {
  if (typeof token !== "string" || token.length > 4096) return null;
  const t = verifyToken<TriviaToken>(token, runSecret());
  if (!t || t.v !== 1 || (t.mode !== "daily" && t.mode !== "unlimited") || !isValidDate(t.date)) return null;
  if (typeof t.salt !== "string" || typeof t.rid !== "string" || !Number.isInteger(t.i) || t.i < 0 || t.i >= QUESTIONS_PER_DAY || !Array.isArray(t.res)) return null;
  const today = puzzleDate();
  if (t.date !== today && t.date !== addDays(today, -1)) return null;
  return t;
}

export function dayFor(t: Pick<TriviaToken, "mode" | "date" | "salt">) {
  return t.mode === "daily" ? getTriviaDay(t.date) : getTriviaUnlimited(t.date, t.salt);
}

/** The question at index i, shuffled for this game. */
export function questionAt(t: Pick<TriviaToken, "mode" | "date" | "salt">, i: number) {
  const id = dayFor(t).questions[i];
  const q = questionById(id);
  if (!q) throw new Error(`Unknown trivia question ${id}`);
  return { q, ...serveQuestion(q, hashSeed("trivia-opt", t.date, t.salt, id)) };
}

export function claimKey(token: string): string {
  return "t:" + createHash("sha256").update(token).digest("hex").slice(0, 40);
}
