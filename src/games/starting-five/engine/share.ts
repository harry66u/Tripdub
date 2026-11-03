import { GRADE_ORDER, type Grades } from "./grades";
import { topPercent } from "./format";

const SHORT: Record<(typeof GRADE_ORDER)[number], string> = {
  sco: "SCO",
  def: "DEF",
  reb: "REB",
  spc: "SPC",
  ply: "PLY",
};

export function gradeEmoji(g: number): string {
  if (g >= 80) return "🟩";
  if (g >= 65) return "🟨";
  if (g >= 50) return "🟧";
  return "🟥";
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "tripdub.app";
}

/** Spoiler-free result for the clipboard: no player names, just the outcome and grades. */
export function shareText(r: {
  puzzleNumber: number;
  won: boolean;
  homeScore: number;
  awayScore: number;
  winProb: number;
  grades: Grades;
  percentile: number | null;
}): string {
  const lines = [
    `TRIPDUB · Starting Five #${r.puzzleNumber}`,
    `${r.won ? "W" : "L"} ${r.homeScore}–${r.awayScore} vs the Mystery Five · Win prob ${Math.round(r.winProb * 100)}%`,
  ];
  if (r.percentile != null) lines.push(`Top ${topPercent(r.percentile)}% today`);
  lines.push(GRADE_ORDER.map((k) => `${SHORT[k]} ${gradeEmoji(r.grades[k])}`).join(" "));
  lines.push(siteUrl());
  return lines.join("\n");
}
