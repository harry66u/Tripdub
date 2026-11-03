import { siteUrl } from "@/games/starting-five/engine/share";
import { topPercent } from "@/games/starting-five/engine/format";
import type { Tier } from "../types";
import { feetFor } from "./scoring";

export const TIER_EMOJI: Record<Tier | "miss", string> = {
  layup: "🟦",
  toocute: "🟪",
  midrange: "🟩",
  three: "🟨",
  logo: "🟧",
  halfcourt: "🔥",
  miss: "⬜",
};

export function tierEmoji(t: Tier | null): string {
  return TIER_EMOJI[t ?? "miss"];
}

export function shareDeepCut(r: {
  puzzleNumber: number | null;
  archive?: boolean;
  tiers: (Tier | null)[];
  score: number;
  percentile: number | null;
}): string {
  const title =
    r.puzzleNumber == null ? "TRIPDUB · Deep Cut · Unlimited" : `TRIPDUB · Deep Cut #${r.puzzleNumber}${r.archive ? " (archive)" : ""}`;
  const lines = [title, r.tiers.map(tierEmoji).join(""), `${r.score} pts · ${feetFor(r.score)} ft of range`];
  if (r.percentile != null) lines.push(`Top ${topPercent(r.percentile)}% today`);
  lines.push(siteUrl());
  return lines.join("\n");
}
