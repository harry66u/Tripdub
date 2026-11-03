import { SLOTS, type Lineup, type Slot } from "../types";
import { GRADE_LABELS, gradeLineup, type GradeKey } from "./grades";
import type { Evaluation, PlayerBox, TeamBox } from "./sim";

type Labels = { home: string; away: string };

const sum = (t: TeamBox, k: keyof PlayerBox) => SLOTS.reduce((s, slot) => s + t.players[slot][k], 0);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function statLine(b: PlayerBox): string {
  const extras: string[] = [];
  if (b.reb >= 5) extras.push(`${b.reb} rebounds`);
  if (b.ast >= 5) extras.push(`${b.ast} assists`);
  if (b.blk >= 3) extras.push(`${b.blk} blocks`);
  if (b.stl >= 3) extras.push(`${b.stl} steals`);
  if (!extras.length) return `${b.pts} points`;
  if (extras.length === 1) return `${b.pts} points and ${extras[0]}`;
  return `${b.pts} points, ${extras.slice(0, -1).join(", ")} and ${extras[extras.length - 1]}`;
}

/** A short, readable recap built from the featured game's box score. */
export function summarize(ev: Evaluation, home: Lineup, away: Lineup, labels: Labels): string {
  const g = ev.featured;
  const homeWon = g.home.score > g.away.score;
  const ot = g.home.quarters.length > 4 ? (g.home.quarters.length === 5 ? " in overtime" : ` in ${g.home.quarters.length - 4} overtimes`) : "";
  const [w, l] = homeWon ? [labels.home, labels.away] : [labels.away, labels.home];
  const [ws, ls] = homeWon ? [g.home.score, g.away.score] : [g.away.score, g.home.score];
  const close = ws - ls <= 4;
  const result = close
    ? `${cap(w)} edged ${l} ${ws}–${ls}${ot}.`
    : ws - ls >= 15
      ? `${cap(w)} ran away from ${l}, ${ws}–${ls}${ot}.`
      : `${cap(w)} beat ${l} ${ws}–${ls}${ot}.`;

  // Top performer across both teams
  const everyone = [
    ...SLOTS.map((s) => ({ p: home[s], b: g.home.players[s] })),
    ...SLOTS.map((s) => ({ p: away[s], b: g.away.players[s] })),
  ].sort((a, b) => b.b.pts - a.b.pts || b.b.reb + b.b.ast - (a.b.reb + a.b.ast));
  const star = everyone[0];
  const top = `${star.p.name} led all scorers with ${statLine(star.b)}.`;

  // Key matchup: the slot with the widest scoring gap
  let key: Slot = "PG";
  let gap = -1;
  for (const s of SLOTS) {
    const d = Math.abs(g.home.players[s].pts - g.away.players[s].pts);
    if (d > gap) {
      gap = d;
      key = s;
    }
  }
  const hp = g.home.players[key].pts;
  const ap = g.away.players[key].pts;
  const [mw, ml, mwp, mlp] = hp >= ap ? [home[key], away[key], hp, ap] : [away[key], home[key], ap, hp];
  const matchup =
    mw.id === star.p.id
      ? `Matched up with him at ${key}, ${ml.name} scored ${plural(mlp, "point")}.`
      : `At ${key}, ${mw.name} outscored ${ml.name} ${mwp} to ${mlp}.`;

  // Deciding dimension: the winner's biggest grade edge, backed by a box-score stat
  const gh = gradeLineup(Object.values(home));
  const ga = gradeLineup(Object.values(away));
  const [gw, gl, bw, bl] = homeWon ? [gh, ga, g.home, g.away] : [ga, gh, g.away, g.home];
  const keys: GradeKey[] = ["spc", "reb", "ply", "def", "sco"];
  const edge = keys.reduce((a, b) => (gw[b] - gl[b] > gw[a] - gl[a] ? b : a));
  let decide: string;
  if (gw[edge] - gl[edge] < 5) {
    decide = g.leadChanges >= 8 ? `The lead changed hands ${g.leadChanges} times.` : `The biggest lead was ${g.biggestLead.pts}.`;
  } else {
    const label = GRADE_LABELS[edge].toLowerCase();
    const detail: Record<GradeKey, string> = {
      spc: `${plural(sum(bw, "fg3m"), "three")} to ${sum(bl, "fg3m")}`,
      reb: `${plural(sum(bw, "reb"), "rebound")} to ${sum(bl, "reb")}`,
      ply: `${plural(sum(bw, "ast"), "assist")} to ${sum(bl, "ast")}`,
      def: `${sum(bw, "stl") + sum(bw, "blk")} steals and blocks to ${sum(bl, "stl") + sum(bl, "blk")}`,
      sco: `${Math.round((100 * sum(bw, "fgm")) / Math.max(1, sum(bw, "fga")))}% shooting to ${Math.round((100 * sum(bl, "fgm")) / Math.max(1, sum(bl, "fga")))}%`,
    };
    decide = `The difference was ${label}: ${detail[edge]}.`;
  }
  return [result, top, matchup, decide].join(" ");
}
