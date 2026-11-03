import prompts from "@/data/deepcut-prompts.json";
import names from "@/data/deepcut-names.json";
import type { DCName, DCPrompt, ServedPrompt } from "../types";
import { buildIndex } from "../engine/match";

/** Every prompt with every valid answer and tier. Server-side only: answers must not reach the client early. */
export const PROMPTS = prompts as unknown as DCPrompt[];
export const NAMES = names as unknown as DCName[];
const BY_ID = new Map(PROMPTS.map((p) => [p.id, p]));
const NAME_BY_ID = new Map(NAMES.map((n) => [n.i, n]));
export const NAME_INDEX = buildIndex(NAMES);

export function promptById(id: string): DCPrompt | undefined {
  return BY_ID.get(id);
}

export function playerName(id: string): string | null {
  return NAME_BY_ID.get(id)?.n ?? null;
}

export function fameOf(id: string): number {
  return NAME_BY_ID.get(id)?.f ?? 0;
}

export function servePrompt(p: DCPrompt): ServedPrompt {
  return { id: p.id, text: p.text, note: p.note, kind: p.kind, count: Object.keys(p.answers).length };
}
