import type { SFPlayer } from "../types";

export type GradeKey = "sco" | "def" | "reb" | "spc" | "ply";
export type Grades = Record<GradeKey, number> & { overall: number };

export const GRADE_LABELS: Record<GradeKey, string> = {
  sco: "Scoring",
  def: "Defense",
  reb: "Rebounding",
  spc: "Spacing",
  ply: "Playmaking",
};
export const GRADE_ORDER: GradeKey[] = ["sco", "def", "reb", "spc", "ply"];

const clamp = (x: number) => Math.max(0, Math.min(100, x));

/** Weighted average of the top values (descending) using the given weights. */
function topWeighted(values: number[], weights: number[]): number {
  const v = values.slice().sort((a, b) => b - a);
  let s = 0;
  let w = 0;
  weights.forEach((wi, i) => {
    if (i < v.length) {
      s += v[i] * wi;
      w += wi;
    }
  });
  return w ? s / w : 0;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Lineup-level grades. They reward composition: one ball to share, one playmaker to run it,
 * a rim protector behind it, and shooters to keep the floor open.
 */
export function gradeLineup(players: SFPlayer[]): Grades {
  const r = (k: keyof SFPlayer["r"]) => players.map((p) => p.r[k]);
  const sco = topWeighted(r("sco"), [0.4, 0.27, 0.18, 0.1, 0.05]);
  const ply = topWeighted(r("ply"), [0.6, 0.25, 0.15]);
  const rebAll = r("reb").reduce((a, b) => a + b, 0) / players.length;
  const reb = 0.8 * topWeighted(r("reb"), [0.45, 0.35, 0.2]) + 0.2 * rebAll;
  const def = 0.5 * topWeighted(r("per"), [0.45, 0.35, 0.2]) + 0.5 * Math.max(...r("rim"));
  const spc = (r("spc").reduce((a, v) => a + sigmoid((v - 55) / 8), 0) / players.length) * 100;
  const g = { sco, def, reb, spc, ply };
  const overall = 0.24 * sco + 0.22 * def + 0.16 * reb + 0.18 * spc + 0.2 * ply;
  return {
    sco: Math.round(clamp(g.sco)),
    def: Math.round(clamp(g.def)),
    reb: Math.round(clamp(g.reb)),
    spc: Math.round(clamp(g.spc)),
    ply: Math.round(clamp(g.ply)),
    overall: Math.round(clamp(overall)),
  };
}

export function letter(grade: number): string {
  if (grade >= 93) return "A+";
  if (grade >= 86) return "A";
  if (grade >= 80) return "A-";
  if (grade >= 75) return "B+";
  if (grade >= 70) return "B";
  if (grade >= 65) return "B-";
  if (grade >= 60) return "C+";
  if (grade >= 55) return "C";
  if (grade >= 50) return "C-";
  if (grade >= 40) return "D";
  return "F";
}
