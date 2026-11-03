/**
 * Fill the daily schedule ahead. Existing days are never changed, so hand edits stick.
 *   npm run schedule                 # launch day through today + 730 days
 *   npm run schedule -- --days 365
 */
import { addDays, LAUNCH_DATE, puzzleDate } from "@/lib/day";
import { POOL } from "@/games/starting-five/server/data";
import { fillSchedule } from "@/games/starting-five/server/schedule";
import { BANK } from "@/games/trivia/server/data";
import { fillTriviaSchedule } from "@/games/trivia/server/schedule";
import { arg, readSF, readTrivia, writeSF, writeTrivia } from "./io";

const ahead = Number(arg("days") ?? 730);
const today = puzzleDate();
const from = LAUNCH_DATE < today ? LAUNCH_DATE : today;
const end = addDays(today, ahead);
let total = 0;
for (let d = from; d <= end; d = addDays(d, 1)) total++;

const sf = readSF();
const added = fillSchedule(sf, POOL, from, total);
writeSF(sf);
console.log(`Starting Five: added ${added.length} day(s); schedule now covers ${Object.keys(sf.days).length} days through ${end}.`);

const trivia = readTrivia();
const addedTrivia = fillTriviaSchedule(trivia, BANK, from, total);
writeTrivia(trivia);
console.log(`Trivia: added ${addedTrivia.length} day(s); schedule now covers ${Object.keys(trivia.days).length} days through ${end}.`);
