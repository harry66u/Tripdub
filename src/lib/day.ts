/** The global puzzle day: one puzzle for everyone, resetting at midnight America/New_York. */
export const PUZZLE_TZ = "America/New_York";
export const LAUNCH_DATE = "2026-11-03";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: PUZZLE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(d: Date) {
  const o: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value;
  return o;
}

/** 'YYYY-MM-DD' of the puzzle day containing `now`. */
export function puzzleDate(now: Date = new Date()): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

function dayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  const t = new Date((dayIndex(date) + n) * 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** Puzzle #1 is launch day. */
export function puzzleNumber(date: string): number {
  return dayIndex(date) - dayIndex(LAUNCH_DATE) + 1;
}

/** Offset (ms) of the puzzle time zone from UTC at instant `d`. */
function tzOffsetMs(d: Date): number {
  const p = parts(d);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** The instant the next puzzle unlocks (midnight in the puzzle time zone). */
export function nextResetAt(now: Date = new Date()): Date {
  const tomorrow = addDays(puzzleDate(now), 1);
  const [y, m, d] = tomorrow.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  // Local midnight = UTC midnight minus the zone offset at that moment; iterate once for DST edges.
  let t = guess - tzOffsetMs(new Date(guess));
  t = guess - tzOffsetMs(new Date(t));
  return new Date(t);
}

export function isValidDate(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && addDays(date, 0) === date;
}
