/** Validate the daily schedule. Exits 1 on errors (used in CI). */
import { puzzleDate } from "@/lib/day";
import { POOL } from "@/games/starting-five/server/data";
import { checkSchedule } from "@/games/starting-five/server/schedule";
import { BANK } from "@/games/trivia/server/data";
import { checkTriviaSchedule } from "@/games/trivia/server/schedule";
import { CHARTS } from "@/games/shot-chart/server/data";
import { checkShotSchedule } from "@/games/shot-chart/server/schedule";
import { PROMPTS } from "@/games/deep-cut/server/data";
import { checkDeepCutSchedule } from "@/games/deep-cut/server/schedule";
import { readDeep, readSF, readShot, readTrivia } from "./io";

const sf = checkSchedule(readSF(), POOL, puzzleDate());
const tv = checkTriviaSchedule(readTrivia(), BANK, puzzleDate());
const sc = checkShotSchedule(readShot(), CHARTS, puzzleDate());
const dc = checkDeepCutSchedule(readDeep(), PROMPTS, puzzleDate());
const errors = [...sf.errors, ...tv.errors, ...sc.errors, ...dc.errors];
const warnings = [...sf.warnings, ...tv.warnings, ...sc.warnings, ...dc.warnings];
for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
if (errors.length) {
  console.error(`${errors.length} error(s).`);
  process.exit(1);
}
console.log(`OK${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
