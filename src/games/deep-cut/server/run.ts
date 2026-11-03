import "server-only";
import { createHash } from "node:crypto";
import { addDays, isValidDate, LAUNCH_DATE, puzzleDate } from "@/lib/day";
import { signToken, verifyToken } from "@/lib/server/token";
import { runSecret } from "@/lib/server/http";
import { PROMPTS_PER_DAY, TIERS, type DCPrompt, type Tier } from "../types";
import { fameOf, playerName, promptById } from "./data";
import { getDeepCutDay, getDeepCutUnlimited } from "./puzzle";

export type DCMode = "daily" | "unlimited" | "archive";
export type DCAnswer = { p: string | null; t: Tier | null; pts: number; ms: number };

export type DCToken = {
  v: 1;
  mode: DCMode;
  /** The day this run was played (tokens expire after a day) */
  date: string;
  /** The puzzle day whose prompts are played (differs from `date` only in the archive) */
  day: string;
  salt: string;
  device: string;
  rid: string;
  i: number;
  /** When the current prompt's shot clock starts (ms epoch, after the read-in); null between prompts */
  at: number | null;
  /** Rejected guesses so far on the current prompt */
  tries: number;
  res: DCAnswer[];
};

export const LATENCY_ALLOWANCE_MS = 300;
export const LATE_GRACE_MS = 1500;
/** Time to read the prompt before the shot clock starts. */
export const LEAD_MS = 3000;
/** Rejected guesses allowed per prompt (a person manages a handful in 25 seconds; a script would not stop). */
export const MAX_TRIES = 12;

export function issueDeepCutToken(t: DCToken): string {
  return signToken(t, runSecret());
}

export function readDeepCutToken(token: unknown): DCToken | null {
  if (typeof token !== "string" || token.length > 6000) return null;
  const t = verifyToken<DCToken>(token, runSecret());
  if (!t || t.v !== 1 || !["daily", "unlimited", "archive"].includes(t.mode) || !isValidDate(t.date) || !isValidDate(t.day)) return null;
  if (typeof t.salt !== "string" || typeof t.rid !== "string" || !Number.isInteger(t.i) || t.i < 0 || t.i >= PROMPTS_PER_DAY || !Array.isArray(t.res)) return null;
  if (!Number.isInteger(t.tries) || t.tries < 0 || t.tries > MAX_TRIES) return null;
  const today = puzzleDate();
  if (t.date !== today && t.date !== addDays(today, -1)) return null;
  return t;
}

/** Archive days: launch day through yesterday. */
export function isArchiveDay(day: unknown, today = puzzleDate()): day is string {
  return typeof day === "string" && isValidDate(day) && day >= LAUNCH_DATE && day < today;
}

export function dayFor(t: Pick<DCToken, "mode" | "date" | "day" | "salt">) {
  return t.mode === "unlimited" ? getDeepCutUnlimited(t.date, t.salt) : getDeepCutDay(t.day);
}

export function promptAt(t: Pick<DCToken, "mode" | "date" | "day" | "salt">, i: number): DCPrompt {
  const id = dayFor(t).prompts[i];
  const p = promptById(id);
  if (!p) throw new Error(`Unknown Deep Cut prompt ${id}`);
  return p;
}

const RARE_ORDER: Tier[] = ["halfcourt", "logo", "three"];

/** A few of the rarest valid answers, hand-picked half-courts first, then the best-known deep cuts. */
export function rarestAnswers(p: DCPrompt, exclude: string | null, n = 3): { n: string; tier: Tier }[] {
  const out: { n: string; tier: Tier }[] = [];
  for (const tier of RARE_ORDER) {
    const ids = Object.entries(p.answers)
      .filter(([id, t]) => t === tier && id !== exclude)
      .map(([id]) => id)
      .sort((a, b) => fameOf(b) - fameOf(a) || (a < b ? -1 : 1));
    for (const id of ids) {
      if (out.length >= n) return out;
      out.push({ n: playerName(id) ?? id, tier });
    }
  }
  return out;
}

export function isTier(x: unknown): x is Tier {
  return typeof x === "string" && (TIERS as readonly string[]).includes(x);
}

export function claimKey(token: string): string {
  return "d:" + createHash("sha256").update(token).digest("hex").slice(0, 40);
}
