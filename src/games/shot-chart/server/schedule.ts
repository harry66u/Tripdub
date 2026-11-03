import { addDays } from "@/lib/day";
import type { ShotChart } from "../types";
import { generateShotDay, type ShotDay } from "./generate";

export type ShotSchedule = { version: 1; days: Record<string, ShotDay> };
export const ANSWER_NO_REPEAT_DAYS = 30;

export function recentAnswerPids(schedule: ShotSchedule, date: string, byId: Map<string, ShotChart>): Set<string> {
  const out = new Set<string>();
  for (let i = 1; i < ANSWER_NO_REPEAT_DAYS; i++) {
    for (const r of schedule.days[addDays(date, -i)]?.rounds ?? []) {
      const pid = byId.get(r.chart)?.pid;
      if (pid) out.add(pid);
    }
  }
  return out;
}

export function fillShotSchedule(schedule: ShotSchedule, charts: ShotChart[], from: string, days: number): string[] {
  const byId = new Map(charts.map((c) => [c.id, c]));
  const added: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (schedule.days[date]) continue;
    const usedCharts = new Set(Object.values(schedule.days).flatMap((d) => d.rounds.map((r) => r.chart)));
    schedule.days[date] = generateShotDay(date, charts, recentAnswerPids(schedule, date, byId), "", usedCharts);
    added.push(date);
  }
  return added;
}

export function checkShotSchedule(schedule: ShotSchedule, charts: ShotChart[], today: string) {
  const byId = new Map(charts.map((c) => [c.id, c]));
  const errors: string[] = [];
  const warnings: string[] = [];
  const dates = Object.keys(schedule.days).sort();
  for (const date of dates) {
    const where = `shot-chart ${date}`;
    const rounds = schedule.days[date].rounds ?? [];
    if (rounds.length !== 5) errors.push(`${where}: needs 5 rounds`);
    rounds.forEach((r, i) => {
      if (!byId.has(r.chart)) errors.push(`${where}: unknown chart "${r.chart}"`);
      if (r.choices?.length !== 4 || !r.choices.includes(r.chart)) errors.push(`${where}: round ${i + 1} needs 4 choices including the answer`);
      for (const c of r.choices ?? []) if (!byId.has(c)) errors.push(`${where}: unknown choice "${c}"`);
    });
  }
  const last = dates[dates.length - 1];
  if (!last || last < addDays(today, 60)) warnings.push(`Shot Chart schedule runs out ${last ? `after ${last}` : "immediately"}; run "npm run schedule".`);
  return { errors, warnings };
}
