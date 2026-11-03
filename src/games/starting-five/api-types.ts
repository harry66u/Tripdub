import type { Clue } from "./engine/archetype";
import type { RunView } from "./engine/run";
import type { Lineup, SFPlayer, Slot } from "./types";

export type { SFResult } from "./server/finish";

export type StartResponse = {
  mode: "daily" | "unlimited";
  date: string;
  puzzleNumber: number | null;
  theme: string;
  opponent: Lineup;
  clues: Record<Slot, Clue>;
  token: string;
  view: RunView;
  current: SFPlayer;
  lineup: Partial<Record<Slot, SFPlayer>>;
  nextResetAt: string;
};

export type StepResponse = {
  token: string;
  view: RunView;
  current: SFPlayer | null;
  lineup: Partial<Record<Slot, SFPlayer>>;
};

/** A face for the roulette: name, tier, NBA.com id, and the season/team its photo should come from */
export type WheelName = { n: string; t: SFPlayer["tier"]; i: number | null; s?: number; tm?: string };
