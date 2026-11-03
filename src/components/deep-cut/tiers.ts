import type { Tier } from "@/games/deep-cut/types";

/** Chip colors per shot range, matching the share emoji (blue, purple, green, yellow, orange, fire). */
export const TIER_CHIP: Record<Tier | "miss", string> = {
  layup: "bg-sky text-ink",
  toocute: "bg-grape text-ink",
  midrange: "bg-mint text-ink",
  three: "bg-butter text-ink",
  logo: "bg-coral text-white",
  halfcourt: "bg-ink text-white",
  miss: "bg-white text-ink-soft",
};

export const TIER_PANEL: Record<Tier | "miss", string> = {
  layup: "bg-sky-soft",
  toocute: "bg-grape-soft",
  midrange: "bg-mint-soft",
  three: "bg-butter-soft",
  logo: "bg-coral-soft",
  halfcourt: "bg-ink text-white",
  miss: "bg-wash",
};
