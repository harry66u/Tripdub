import "server-only";
import { createHash } from "node:crypto";
import { addDays, isValidDate, puzzleDate } from "@/lib/day";
import { signToken, verifyToken } from "@/lib/server/token";
import { runSecret } from "@/lib/server/http";
import { ROUNDS_PER_DAY, ZONES, type ShotChart, type ZoneId } from "../types";
import { chartById, leagueFor } from "./data";
import { getShotDay, getShotUnlimited } from "./puzzle";

export type ShotToken = {
  v: 1;
  mode: "daily" | "unlimited";
  date: string;
  salt: string;
  device: string;
  rid: string;
  i: number;
  at: number | null;
  res: { c: number | null; ms: number; pts: number; ok: boolean }[];
};

export const LATENCY_ALLOWANCE_MS = 300;

export function issueShotToken(t: ShotToken) {
  return signToken(t, runSecret());
}

export function readShotToken(token: unknown): ShotToken | null {
  if (typeof token !== "string" || token.length > 4096) return null;
  const t = verifyToken<ShotToken>(token, runSecret());
  if (!t || t.v !== 1 || (t.mode !== "daily" && t.mode !== "unlimited") || !isValidDate(t.date)) return null;
  if (typeof t.salt !== "string" || typeof t.rid !== "string" || !Number.isInteger(t.i) || t.i < 0 || t.i >= ROUNDS_PER_DAY) return null;
  if (!Array.isArray(t.res)) return null;
  const today = puzzleDate();
  if (t.date !== today && t.date !== addDays(today, -1)) return null;
  return t;
}

export function roundAt(t: Pick<ShotToken, "mode" | "date" | "salt">, i: number) {
  const day = t.mode === "daily" ? getShotDay(t.date) : getShotUnlimited(t.date, t.salt);
  const r = day.rounds[i];
  const answer = chartById(r.chart)!;
  const choices = r.choices.map((id) => chartById(id)!);
  return { answer, choices, correctIndex: r.choices.indexOf(r.chart) };
}

export type ServedZone = { a: number; m: number; pct: number | null; rel: number | null; share: number };

/**
 * The chart as players see it: attempts, makes, FG% and how that compares to the league in that
 * zone that season (in percentage points, rounded), with no name, team or season attached.
 */
export function serveChart(c: ShotChart): { zones: Record<ZoneId, ServedZone>; fga: number; fgPct: number } {
  const league = leagueFor(c.season);
  const zones = {} as Record<ZoneId, ServedZone>;
  for (const z of ZONES) {
    const [m, a] = c.zones[z];
    const [lm, la] = league[z];
    const pct = a ? m / a : null;
    zones[z] = {
      a,
      m,
      pct: pct == null ? null : Math.round(pct * 1000) / 1000,
      rel: pct == null || !la ? null : Math.round((pct - lm / la) * 1000) / 10,
      share: Math.round((a / c.fga) * 1000) / 1000,
    };
  }
  return { zones, fga: c.fga, fgPct: Math.round((c.fgm / c.fga) * 1000) / 1000 };
}

export function revealOf(c: ShotChart) {
  return { name: c.name, season: c.season, team: c.team, nbaId: c.nbaId, pos: c.pos, line: c.line, allStar: c.allStar, fga: c.fga };
}

export const TIER_LABEL = ["", "Star", "Starter", "Rotation", "Role player", "Deep cut"];

export function servedRound(t: Pick<ShotToken, "mode" | "date" | "salt">, i: number) {
  const { answer, choices } = roundAt(t, i);
  return { index: i, total: ROUNDS_PER_DAY, tier: answer.tier, tierLabel: TIER_LABEL[answer.tier], choices: choices.map((c) => c.name), ...serveChart(answer) };
}

export function claimKey(token: string) {
  return "c:" + createHash("sha256").update(token).digest("hex").slice(0, 40);
}
