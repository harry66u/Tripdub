import players from "@/data/sf-players.json";
import type { SFPlayer } from "../types";

/** The full Starting Five pool. Server-side only: never import from a client component. */
export const POOL = players as SFPlayer[];

const BY_ID = new Map(POOL.map((p) => [p.id, p]));

export function playerById(id: string): SFPlayer | undefined {
  return BY_ID.get(id);
}

export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_NAME = new Map(POOL.map((p) => [normalizeName(p.name), p]));

/** Case- and accent-insensitive lookup by display name or Basketball-Reference id. */
export function findPlayer(nameOrId: string): SFPlayer | undefined {
  return BY_ID.get(nameOrId.trim()) ?? BY_NAME.get(normalizeName(nameOrId));
}
