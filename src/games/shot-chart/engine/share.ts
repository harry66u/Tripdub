import { siteUrl } from "@/games/starting-five/engine/share";
import { topPercent } from "@/games/starting-five/engine/format";

export function shareShot(r: { puzzleNumber: number | null; results: boolean[]; score: number; percentile: number | null }): string {
  const lines = [
    r.puzzleNumber == null ? "TRIPDUB · Shot Chart · Unlimited" : `TRIPDUB · Shot Chart #${r.puzzleNumber}`,
    r.results.map((ok) => (ok ? "🎯" : "❌")).join(""),
    `${r.results.filter(Boolean).length}/${r.results.length} · ${r.score.toLocaleString("en-US")} pts`,
  ];
  if (r.percentile != null) lines.push(`Top ${topPercent(r.percentile)}% today`);
  lines.push(siteUrl());
  return lines.join("\n");
}
