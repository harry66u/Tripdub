import scheduleJson from "../../../../content/schedule/deep-cut.json";
import { PROMPTS_PER_DAY } from "../types";
import { PROMPTS, promptById } from "./data";
import { generateDeepCutDay, type DCDay } from "./generate";
import { usageBefore, type DCSchedule } from "./schedule";

const schedule = scheduleJson as DCSchedule;

/**
 * The daily set. Scheduled days win; a prompt that has since been removed or disabled is swapped
 * for a generated one, so an edit to the prompt bank can never break a live day.
 */
export function getDeepCutDay(date: string): DCDay {
  const scheduled = schedule.days[date]?.prompts.filter((id) => promptById(id)) ?? [];
  if (scheduled.length === PROMPTS_PER_DAY) return { prompts: scheduled };
  const generated = generateDeepCutDay(date, PROMPTS, usageBefore(schedule, date), "", scheduled).prompts;
  if (!scheduled.length) return { prompts: generated };
  const extra = generated.filter((id) => !scheduled.includes(id)).slice(0, PROMPTS_PER_DAY - scheduled.length);
  return { prompts: [...scheduled, ...extra] };
}

/** A fresh random set for an unlimited game. */
export function getDeepCutUnlimited(date: string, salt: string): DCDay {
  return generateDeepCutDay(date, PROMPTS, new Map(), salt);
}
