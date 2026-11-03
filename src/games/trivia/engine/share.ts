import { siteUrl } from "@/games/starting-five/engine/share";
import { topPercent } from "@/games/starting-five/engine/format";

/** ⚡ fast and right (under 5s), 🟩 right, 🟥 wrong or out of time */
export function answerEmoji(r: { correct: boolean; ms: number }): string {
  if (!r.correct) return "🟥";
  return r.ms < 5000 ? "⚡" : "🟩";
}

export function shareTrivia(r: {
  puzzleNumber: number | null;
  results: { correct: boolean; ms: number }[];
  score: number;
  percentile: number | null;
}): string {
  const right = r.results.filter((x) => x.correct).length;
  const lines = [
    r.puzzleNumber == null ? "TRIPDUB · Daily Trivia · Unlimited" : `TRIPDUB · Daily Trivia #${r.puzzleNumber}`,
    r.results.map(answerEmoji).join(""),
    `${right}/${r.results.length} right · ${r.score.toLocaleString("en-US")} pts`,
  ];
  if (r.percentile != null) lines.push(`Top ${topPercent(r.percentile)}% today`);
  lines.push(siteUrl());
  return lines.join("\n");
}
