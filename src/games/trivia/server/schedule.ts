import { addDays } from "@/lib/day";
import { DAY_MIX, type TriviaQuestion } from "../types";
import { generateTriviaDay, type TriviaDay } from "./generate";

export type TriviaSchedule = { version: 1; days: Record<string, TriviaDay> };

export const RUNWAY_WARNING_DAYS = 60;

/** question id -> most recent date it was used, for every scheduled day before `before`. */
export function usageBefore(schedule: TriviaSchedule, before: string): Map<string, string> {
  const used = new Map<string, string>();
  for (const date of Object.keys(schedule.days).sort()) {
    if (date >= before) break;
    for (const id of schedule.days[date].questions) used.set(id, date);
  }
  return used;
}

export function fillTriviaSchedule(schedule: TriviaSchedule, bank: TriviaQuestion[], from: string, days: number): string[] {
  const added: string[] = [];
  const used = usageBefore(schedule, from);
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (!schedule.days[date]) {
      schedule.days[date] = generateTriviaDay(date, bank, used);
      added.push(date);
    }
    for (const id of schedule.days[date].questions) used.set(id, date);
  }
  return added;
}

export function checkTriviaSchedule(
  schedule: TriviaSchedule,
  bank: TriviaQuestion[],
  today: string,
): { errors: string[]; warnings: string[] } {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Map<string, string>();
  let firstRepeat: string | null = null;
  const dates = Object.keys(schedule.days).sort();
  for (const date of dates) {
    const where = `trivia ${date}`;
    const ids = schedule.days[date].questions ?? [];
    if (ids.length !== DAY_MIX.length) errors.push(`${where}: needs ${DAY_MIX.length} questions`);
    if (new Set(ids).size !== ids.length) errors.push(`${where}: duplicate question`);
    ids.forEach((id, i) => {
      const q = byId.get(id);
      if (!q) errors.push(`${where}: unknown question "${id}"`);
      else if (q.diff !== DAY_MIX[i]) warnings.push(`${where}: question ${i + 1} is ${q.diff}, expected ${DAY_MIX[i]}`);
      if (seen.has(id) && !firstRepeat) firstRepeat = date;
      seen.set(id, date);
    });
  }
  if (firstRepeat) warnings.push(`Trivia questions start to repeat on ${firstRepeat}; add more questions to the bank before then.`);
  const last = dates[dates.length - 1];
  if (!last || last < addDays(today, RUNWAY_WARNING_DAYS)) {
    warnings.push(`Trivia schedule runs out ${last ? `after ${last}` : "immediately"}; run "npm run schedule".`);
  }
  return { errors, warnings };
}
