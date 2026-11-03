import scheduleJson from "../../../../content/schedule/starting-five.json";
import { POOL } from "./data";
import { generateSFPuzzle, type SFPuzzle } from "./generate";
import { recentSpins, type SFSchedule } from "./schedule";

const schedule = scheduleJson as SFSchedule;

/** Today's puzzle: the scheduled one if present, otherwise generated from the date. */
export function getSFPuzzle(date: string): SFPuzzle {
  return schedule.days[date] ?? generateSFPuzzle(date, POOL, recentSpins(schedule, date));
}
