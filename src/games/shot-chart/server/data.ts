import data from "@/data/shotcharts.json";
import type { MadeAttempted, ShotChart, ZoneId } from "../types";

const d = data as unknown as { version: 1; zones: ZoneId[]; league: Record<string, Record<ZoneId, MadeAttempted>>; charts: ShotChart[] };

/** All charts. Server-side only: the answer must not reach the client before a guess. */
export const CHARTS = d.charts;
const BY_ID = new Map(CHARTS.map((c) => [c.id, c]));

export function chartById(id: string): ShotChart | undefined {
  return BY_ID.get(id);
}

export function leagueFor(season: number): Record<ZoneId, MadeAttempted> {
  return d.league[String(season)];
}
