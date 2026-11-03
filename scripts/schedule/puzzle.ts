/**
 * View or edit one day's puzzle.
 *   npm run puzzle -- show 2026-12-25
 *   npm run puzzle -- set 2026-12-25 --spins "Magic Johnson, Reggie Miller, Grant Hill, Tim Duncan, Yao Ming, Steve Nash"
 *   npm run puzzle -- set 2026-12-25 --mystery "PG:Isiah Thomas,SG:Michael Jordan,SF:Larry Bird,PF:Kevin McHale,C:Moses Malone" --theme "Christmas Classics"
 *   npm run puzzle -- reroll 2026-12-25
 * Names are case- and accent-insensitive; Basketball-Reference ids work too.
 */
import { isValidDate } from "@/lib/day";
import { findPlayer, playerById, POOL } from "@/games/starting-five/server/data";
import { generateSFPuzzle } from "@/games/starting-five/server/generate";
import { checkSchedule, recentSpins } from "@/games/starting-five/server/schedule";
import { SLOTS, type Slot } from "@/games/starting-five/types";
import { arg, readSF, writeSF } from "./io";

const [cmd, date] = process.argv.slice(2);
const die = (m: string): never => {
  console.error(m);
  process.exit(1);
};
if (!cmd || !["show", "set", "reroll"].includes(cmd)) die("Usage: npm run puzzle -- show|set|reroll <YYYY-MM-DD> [--spins ...] [--mystery ...] [--theme ...]");
if (!isValidDate(date)) die(`Not a date: ${date ?? "(missing)"}`);

const sf = readSF();
const resolve = (name: string) => findPlayer(name)?.id ?? die(`No player in the pool matches "${name.trim()}".`);
const describe = (id: string) => {
  const p = playerById(id);
  return p ? `${p.name} (${p.pos}, ${p.tier})` : `${id} (unknown!)`;
};

if (cmd === "reroll") {
  sf.days[date] = generateSFPuzzle(date, POOL, recentSpins(sf, date), String(Date.now()));
} else if (cmd === "set") {
  const day = sf.days[date] ?? generateSFPuzzle(date, POOL, recentSpins(sf, date));
  const spins = arg("spins");
  if (spins) {
    const ids = spins.split(",").filter((s) => s.trim()).map(resolve);
    if (ids.length !== 6) die(`--spins needs 6 players (5 plus the re-spin); got ${ids.length}.`);
    day.spins = ids;
  }
  const mystery = arg("mystery");
  if (mystery) {
    for (const part of mystery.split(",")) {
      const [slot, name] = part.split(":");
      const s = slot?.trim().toUpperCase() as Slot;
      if (!SLOTS.includes(s) || !name) die(`--mystery entries look like "PG:Name"; got "${part}".`);
      day.mystery[s] = resolve(name);
    }
  }
  const theme = arg("theme");
  if (theme) day.theme = theme;
  sf.days[date] = day;
}

if (cmd !== "show") {
  const { errors } = checkSchedule({ version: 1, days: { [date]: sf.days[date] } }, POOL, date);
  if (errors.length) die(errors.join("\n"));
  writeSF(sf);
}
const d = sf.days[date];
if (!d) die(`${date} is not scheduled yet (it will be generated on the fly). Run "npm run schedule".`);
console.log(`${date}  theme: ${d.theme}`);
console.log("Spins:");
d.spins.forEach((id, i) => console.log(`  ${i + 1}. ${describe(id)}${i === 5 ? "  ← only seen after a re-spin" : ""}`));
console.log("Mystery Five:");
for (const s of SLOTS) console.log(`  ${s.padEnd(2)} ${describe(d.mystery[s])}`);
