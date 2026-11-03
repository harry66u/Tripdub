/** Validate the daily schedule. Exits 1 on errors (used in CI). */
import { puzzleDate } from "@/lib/day";
import { POOL } from "@/games/starting-five/server/data";
import { checkSchedule } from "@/games/starting-five/server/schedule";
import { readSF } from "./io";

const { errors, warnings } = checkSchedule(readSF(), POOL, puzzleDate());
for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
if (errors.length) {
  console.error(`${errors.length} error(s).`);
  process.exit(1);
}
console.log(`OK${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
