import type { Clue } from "./engine/archetype";
import type { RunView } from "./engine/run";
import type { SFPlayer, Slot } from "./types";

export type { SFResult } from "./server/finish";

export type StartResponse = {
  date: string;
  puzzleNumber: number;
  theme: string;
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

export type WheelName = { n: string; t: SFPlayer["tier"] };
