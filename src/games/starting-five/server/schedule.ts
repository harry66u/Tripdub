import { addDays } from "@/lib/day";
import { SLOTS, type SFPlayer } from "../types";
import { generateSFPuzzle, type SFPuzzle } from "./generate";

export type SFSchedule = { version: 1; days: Record<string, SFPuzzle> };

export const NO_REPEAT_DAYS = 45;
export const RUNWAY_WARNING_DAYS = 60;

/** Spin ids used in the `NO_REPEAT_DAYS - 1` days before `date`. */
export function recentSpins(schedule: SFSchedule, date: string): Set<string> {
  const recent = new Set<string>();
  for (let i = 1; i < NO_REPEAT_DAYS; i++) {
    schedule.days[addDays(date, -i)]?.spins.forEach((id) => recent.add(id));
  }
  return recent;
}

/** Fill `days` consecutive dates from `from`. Existing dates are never touched. Returns dates added. */
export function fillSchedule(schedule: SFSchedule, pool: SFPlayer[], from: string, days: number): string[] {
  const added: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (schedule.days[date]) continue;
    schedule.days[date] = generateSFPuzzle(date, pool, recentSpins(schedule, date));
    added.push(date);
  }
  return added;
}

export function checkSchedule(
  schedule: SFSchedule,
  pool: SFPlayer[],
  today: string,
): { errors: string[]; warnings: string[] } {
  const ids = new Set(pool.map((p) => p.id));
  const errors: string[] = [];
  const warnings: string[] = [];
  const dates = Object.keys(schedule.days).sort();
  for (const date of dates) {
    const d = schedule.days[date];
    const where = `starting-five ${date}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || addDays(date, 0) !== date) errors.push(`${where}: bad date`);
    if (!Array.isArray(d.spins) || d.spins.length !== 6) errors.push(`${where}: needs exactly 6 spins`);
    if (new Set(d.spins).size !== d.spins.length) errors.push(`${where}: duplicate spin`);
    for (const id of d.spins ?? []) if (!ids.has(id)) errors.push(`${where}: unknown spin player "${id}"`);
    const m = SLOTS.map((s) => d.mystery?.[s]);
    for (const [i, id] of m.entries()) {
      if (!id) errors.push(`${where}: Mystery Five missing ${SLOTS[i]}`);
      else if (!ids.has(id)) errors.push(`${where}: unknown mystery player "${id}"`);
    }
    if (new Set(m).size !== 5) errors.push(`${where}: duplicate Mystery Five player`);
    if (m.some((id) => id && d.spins?.includes(id))) errors.push(`${where}: a Mystery Five player is also a spin`);
    if (!d.theme) errors.push(`${where}: missing theme`);
    const recent = recentSpins(schedule, date);
    const repeats = (d.spins ?? []).filter((id) => recent.has(id));
    if (repeats.length) warnings.push(`${where}: ${repeats.join(", ")} spun within the last ${NO_REPEAT_DAYS} days`);
  }
  const last = dates[dates.length - 1];
  const horizon = addDays(today, RUNWAY_WARNING_DAYS);
  if (!last || last < horizon) {
    warnings.push(`Starting Five schedule runs out ${last ? `after ${last}` : "immediately"}; run "npm run schedule".`);
  }
  for (let i = 0; i < RUNWAY_WARNING_DAYS; i++) {
    const date = addDays(today, i);
    if (last && date <= last && !schedule.days[date]) warnings.push(`starting-five ${date}: missing (will be generated on the fly)`);
  }
  return { errors, warnings };
}
