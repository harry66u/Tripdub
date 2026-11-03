import "server-only";
import { addDays, isValidDate, puzzleDate } from "@/lib/day";
import { signToken, verifyToken } from "@/lib/server/token";
import { runSecret } from "@/lib/server/http";
import { isAction } from "../engine/run";
import type { RunToken } from "./finish";

export function issueRunToken(t: RunToken): string {
  return signToken(t, runSecret());
}

/** Verify a run token. Runs from today or yesterday are accepted (a run can cross midnight). */
export function readRunToken(token: unknown): RunToken | null {
  if (typeof token !== "string" || token.length > 4096) return null;
  const t = verifyToken<RunToken>(token, runSecret());
  if (!t || t.v !== 1 || !isValidDate(t.date) || !Array.isArray(t.actions) || !t.actions.every(isAction)) return null;
  const today = puzzleDate();
  if (t.date !== today && t.date !== addDays(today, -1)) return null;
  return t;
}
