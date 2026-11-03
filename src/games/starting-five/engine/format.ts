import type { SFPlayer } from "../types";

const DASH = "—";

const one = (v: number | null) => (v == null ? DASH : v.toFixed(1));
const pct = (v: number | null) => (v == null ? DASH : v.toFixed(3).replace(/^0/, ""));

/** Per-game line for cards. Stats the league didn't track in that era show as a dash. */
export function formatLine(line: SFPlayer["line"]): { label: string; value: string }[] {
  return [
    { label: "PTS", value: one(line.pts) },
    { label: "REB", value: one(line.reb) },
    { label: "AST", value: one(line.ast) },
    { label: "STL", value: one(line.stl) },
    { label: "BLK", value: one(line.blk) },
    { label: "3P%", value: pct(line.fg3Pct) },
    { label: "3PA", value: one(line.fg3a) },
    { label: "FT%", value: pct(line.ftPct) },
    { label: "TS%", value: pct(line.tsPct) },
  ];
}

/** Prime seasons as "1987–93" (season end years 1988..1993). */
export function formatPrime(prime: SFPlayer["prime"]): string {
  return `${prime.from - 1}–${String(prime.to).slice(2)}`;
}

/** Height in feet and inches, e.g. 6'9" */
export function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

/** Share of results you beat (0..1) -> "top N%" (1..100). */
export function topPercent(percentile: number): number {
  return Math.max(1, Math.min(100, Math.ceil((1 - percentile) * 100 - 1e-9)));
}

export function formatWinProb(p: number): string {
  const v = p * 100;
  if (v > 99.9) return ">99.9%";
  if (v < 0.1) return "<0.1%";
  return `${v.toFixed(1)}%`;
}
