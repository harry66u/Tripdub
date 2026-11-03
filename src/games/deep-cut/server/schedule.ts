import { addDays } from "@/lib/day";
import { GENERAL_PER_DAY, PROMPTS_PER_DAY, SPECIFIC_PER_DAY, type DCPrompt } from "../types";
import { generateDeepCutDay, type DCDay } from "./generate";

export type DCSchedule = { version: 1; days: Record<string, DCDay> };

export const RUNWAY_WARNING_DAYS = 60;
/** A prompt back within this many days gets a warning: its rare answers are still fresh in memory. */
export const REPEAT_WARNING_DAYS = 21;

export function usageBefore(schedule: DCSchedule, before: string): Map<string, string> {
  const used = new Map<string, string>();
  for (const date of Object.keys(schedule.days).sort()) {
    if (date >= before) break;
    for (const id of schedule.days[date].prompts) used.set(id, date);
  }
  return used;
}

export function fillDeepCutSchedule(schedule: DCSchedule, bank: DCPrompt[], from: string, days: number): string[] {
  const added: string[] = [];
  const used = usageBefore(schedule, from);
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (!schedule.days[date]) {
      schedule.days[date] = generateDeepCutDay(date, bank, used);
      added.push(date);
    }
    for (const id of schedule.days[date].prompts) used.set(id, date);
  }
  return added;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function checkDeepCutSchedule(schedule: DCSchedule, bank: DCPrompt[], today: string): { errors: string[]; warnings: string[] } {
  const byId = new Map(bank.map((p) => [p.id, p]));
  const errors: string[] = [];
  const warnings: string[] = [];
  const last = new Map<string, string>();
  let repeats = 0;
  const dates = Object.keys(schedule.days).sort();
  for (const date of dates) {
    const where = `deep-cut ${date}`;
    const ids = schedule.days[date].prompts ?? [];
    if (ids.length !== PROMPTS_PER_DAY) errors.push(`${where}: needs ${PROMPTS_PER_DAY} prompts`);
    if (new Set(ids).size !== ids.length) errors.push(`${where}: duplicate prompt`);
    const known = ids.map((id) => byId.get(id));
    ids.forEach((id, i) => {
      if (!known[i]) errors.push(`${where}: unknown prompt "${id}" (removed or disabled? edit the day or delete it and run "npm run schedule")`);
      const prev = last.get(id);
      if (prev && daysBetween(prev, date) < REPEAT_WARNING_DAYS && date >= today) repeats++;
      last.set(id, date);
    });
    const ps = known.filter((p): p is DCPrompt => !!p);
    if (ps.length === PROMPTS_PER_DAY) {
      const g = ps.filter((p) => p.kind === "general").length;
      if (g !== GENERAL_PER_DAY) warnings.push(`${where}: ${g} general / ${PROMPTS_PER_DAY - g} specific (usual mix is ${GENERAL_PER_DAY}/${SPECIFIC_PER_DAY})`);
    }
  }
  if (repeats) warnings.push(`Deep Cut: ${repeats} upcoming prompt(s) come back within ${REPEAT_WARNING_DAYS} days; add prompts to stretch the rotation.`);
  const end = dates[dates.length - 1];
  if (!end || end < addDays(today, RUNWAY_WARNING_DAYS)) warnings.push(`Deep Cut schedule runs out ${end ? `after ${end}` : "immediately"}; run "npm run schedule".`);
  return { errors, warnings };
}
