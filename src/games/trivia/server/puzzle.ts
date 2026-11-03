import scheduleJson from "../../../../content/schedule/trivia.json";
import { BANK } from "./data";
import { generateTriviaDay, type TriviaDay } from "./generate";
import { usageBefore, type TriviaSchedule } from "./schedule";

const schedule = scheduleJson as TriviaSchedule;

export function getTriviaDay(date: string): TriviaDay {
  return schedule.days[date] ?? generateTriviaDay(date, BANK, usageBefore(schedule, date));
}

/** A fresh set for an unlimited game. */
export function getTriviaUnlimited(date: string, salt: string): TriviaDay {
  return generateTriviaDay(date, BANK, new Map(), salt);
}
