import type { DayProgress } from "./progress";

/** One share for the whole day: the key line(s) from each game's own share text. */
export function combinedShare(puzzleNumber: number, day: DayProgress): string {
  const body = (share?: string) => (share ?? "").split("\n").slice(1, -1).filter((l) => !/^Top \d+%/.test(l));
  const sf = body(day.sf?.share);
  const tv = body(day.trivia?.share);
  const sc = body(day.shot?.share);
  const dc = body(day.deep?.share);
  const url = (day.sf?.share ?? day.trivia?.share ?? day.shot?.share ?? day.deep?.share ?? "tripdub.app").split("\n").at(-1);
  return [
    `TRIPDUB #${puzzleNumber} · All four done`,
    `Starting Five: ${sf[0] ?? ""}`,
    `NBA Trivia: ${tv.join(" ")}`,
    `Shot Chart: ${sc.join(" ")}`,
    `Deep Cut: ${dc.join(" ")}`,
    url,
  ].join("\n");
}
