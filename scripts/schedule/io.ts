import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SFSchedule } from "@/games/starting-five/server/schedule";
import type { TriviaSchedule } from "@/games/trivia/server/schedule";
import type { ShotSchedule } from "@/games/shot-chart/server/schedule";
import type { DCSchedule } from "@/games/deep-cut/server/schedule";

export const SF_PATH = join(process.cwd(), "content", "schedule", "starting-five.json");

export function readSF(): SFSchedule {
  if (!existsSync(SF_PATH)) return { version: 1, days: {} };
  return JSON.parse(readFileSync(SF_PATH, "utf8")) as SFSchedule;
}

/** One day per line, sorted, so edits and diffs stay readable. */
export function writeSF(s: SFSchedule) {
  const dates = Object.keys(s.days).sort();
  const body = dates.map((d) => `    ${JSON.stringify(d)}: ${JSON.stringify(s.days[d])}`).join(",\n");
  writeFileSync(SF_PATH, `{\n  "version": 1,\n  "days": {\n${body}\n  }\n}\n`);
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const TRIVIA_PATH = join(process.cwd(), "content", "schedule", "trivia.json");

export function readJsonSchedule<T>(path: string): T {
  if (!existsSync(path)) return { version: 1, days: {} } as T;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** One day per line, sorted. */
export function writeJsonSchedule(path: string, s: { version: number; days: Record<string, unknown> }) {
  const dates = Object.keys(s.days).sort();
  const body = dates.map((d) => `    ${JSON.stringify(d)}: ${JSON.stringify(s.days[d])}`).join(",\n");
  writeFileSync(path, `{\n  "version": 1,\n  "days": {\n${body}\n  }\n}\n`);
}

export const readTrivia = () => readJsonSchedule<TriviaSchedule>(TRIVIA_PATH);
export const writeTrivia = (s: TriviaSchedule) => writeJsonSchedule(TRIVIA_PATH, s);

export const SHOT_PATH = join(process.cwd(), "content", "schedule", "shot-chart.json");
export const readShot = () => readJsonSchedule<ShotSchedule>(SHOT_PATH);
export const writeShot = (s: ShotSchedule) => writeJsonSchedule(SHOT_PATH, s);

export const DEEP_PATH = join(process.cwd(), "content", "schedule", "deep-cut.json");
export const readDeep = () => readJsonSchedule<DCSchedule>(DEEP_PATH);
export const writeDeep = (s: DCSchedule) => writeJsonSchedule(DEEP_PATH, s);
