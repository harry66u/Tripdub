/** Validate the daily schedule. Exits 1 on errors (used in CI). */
import { puzzleDate } from "@/lib/day";
import { POOL } from "@/games/starting-five/server/data";
import { checkSchedule } from "@/games/starting-five/server/schedule";
import { BANK } from "@/games/trivia/server/data";
import { checkTriviaSchedule } from "@/games/trivia/server/schedule";
import { CHARTS } from "@/games/shot-chart/server/data";
import { checkShotSchedule } from "@/games/shot-chart/server/schedule";
import { readSF, readShot, readTrivia } from "./io";

const sf = checkSchedule(readSF(), POOL, puzzleDate());
const tv = checkTriviaSchedule(readTrivia(), BANK, puzzleDate());
const sc = checkShotSchedule(readShot(), CHARTS, puzzleDate());
const errors = [...sf.errors, ...tv.errors, ...sc.errors];
const warnings = [...sf.warnings, ...tv.warnings, ...sc.warnings];
for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
if (errors.length) {
  console.error(`${errors.length} error(s).`);
  process.exit(1);
}
console.log(`OK${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
