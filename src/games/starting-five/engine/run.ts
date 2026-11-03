import { SLOTS, type Slot } from "../types";

export type Action = { t: "place"; slot: Slot } | { t: "respin" };

export type RunView = {
  /** Index into the shared spin sequence of the player currently on the wheel */
  index: number;
  currentId: string | null;
  lineup: Partial<Record<Slot, string>>;
  respinsLeft: number;
  done: boolean;
};

export const RESPINS = 1;
export const SEQUENCE_LENGTH = 6;

export class RunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunError";
  }
}

export function isAction(a: unknown): a is Action {
  if (!a || typeof a !== "object") return false;
  const o = a as Record<string, unknown>;
  if (o.t === "respin") return Object.keys(o).length === 1;
  return o.t === "place" && SLOTS.includes(o.slot as Slot) && Object.keys(o).length === 2;
}

/**
 * Rebuild a run from its action history. Every action consumes the player on the wheel:
 * placing locks him into a slot, a re-spin passes on him. Everyone shares one sequence.
 */
export function replay(sequence: readonly string[], actions: readonly Action[]): RunView {
  const lineup: Partial<Record<Slot, string>> = {};
  let respinsLeft = RESPINS;
  let index = 0;
  let placed = 0;
  for (const a of actions) {
    if (!isAction(a)) throw new RunError("Unknown action");
    if (placed === SLOTS.length) throw new RunError("Your lineup is already full");
    if (index >= sequence.length) throw new RunError("No spins left");
    if (a.t === "respin") {
      if (respinsLeft <= 0) throw new RunError("You've already used your re-spin");
      respinsLeft--;
    } else {
      if (lineup[a.slot]) throw new RunError(`${a.slot} is already filled`);
      lineup[a.slot] = sequence[index];
      placed++;
    }
    index++;
  }
  const done = placed === SLOTS.length;
  return { index, currentId: done ? null : (sequence[index] ?? null), lineup, respinsLeft, done };
}
