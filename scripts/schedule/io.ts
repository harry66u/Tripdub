import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SFSchedule } from "@/games/starting-five/server/schedule";

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
