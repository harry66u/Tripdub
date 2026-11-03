import scheduleJson from "../../../../content/schedule/shot-chart.json";
import { CHARTS } from "./data";
import { generateShotDay, type ShotDay } from "./generate";
import { recentAnswerPids, type ShotSchedule } from "./schedule";

const schedule = scheduleJson as ShotSchedule;
const BY_ID = new Map(CHARTS.map((c) => [c.id, c]));

export function getShotDay(date: string): ShotDay {
  return schedule.days[date] ?? generateShotDay(date, CHARTS, recentAnswerPids(schedule, date, BY_ID));
}

export function getShotUnlimited(date: string, salt: string): ShotDay {
  return generateShotDay(date, CHARTS, new Set(), salt);
}
