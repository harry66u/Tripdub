import { describe, expect, it } from "vitest";
import { CHARTS, chartById } from "@/games/shot-chart/server/data";
import { generateShotDay } from "@/games/shot-chart/server/generate";
import { checkShotSchedule, fillShotSchedule, type ShotSchedule } from "@/games/shot-chart/server/schedule";
import { pointsForGuess, ROUND_LIMIT_MS } from "@/games/shot-chart/engine/scoring";
import { shareShot } from "@/games/shot-chart/engine/share";

describe("generateShotDay", () => {
  const day = generateShotDay("2026-11-03", CHARTS, new Set());

  it("deals five rounds from star to deep cut", () => {
    expect(day.rounds.map((r) => chartById(r.chart)!.tier)).toEqual([1, 2, 3, 4, 5]);
  });

  it("offers four different players, one of them the answer, from the same era", () => {
    for (const r of day.rounds) {
      const answer = chartById(r.chart)!;
      expect(r.choices).toHaveLength(4);
      expect(r.choices).toContain(r.chart);
      const pids = r.choices.map((id) => chartById(id)!.pid);
      expect(new Set(pids).size).toBe(4);
      for (const id of r.choices) expect(Math.abs(chartById(id)!.season - answer.season)).toBeLessThanOrEqual(3);
    }
  });

  it("is deterministic per date and differs per salt", () => {
    expect(generateShotDay("2026-11-03", CHARTS, new Set())).toEqual(day);
    expect(generateShotDay("2026-11-03", CHARTS, new Set(), "x").rounds[0].chart).not.toBe(
      generateShotDay("2026-11-03", CHARTS, new Set(), "y").rounds[0].chart,
    );
  });
});

describe("shot chart schedule", () => {
  const s: ShotSchedule = { version: 1, days: {} };
  fillShotSchedule(s, CHARTS, "2026-11-03", 90);
  it("doesn't repeat an answer player within 30 days", () => {
    const dates = Object.keys(s.days).sort();
    for (let i = 0; i < dates.length; i++) {
      const recent = new Set<string>();
      for (let j = Math.max(0, i - 29); j < i; j++) s.days[dates[j]].rounds.forEach((r) => recent.add(chartById(r.chart)!.pid!));
      for (const r of s.days[dates[i]].rounds) expect(recent.has(chartById(r.chart)!.pid!)).toBe(false);
    }
  });
  it("passes the checker, which catches unknown charts", () => {
    expect(checkShotSchedule(s, CHARTS, "2026-11-03").errors).toEqual([]);
    const bad: ShotSchedule = JSON.parse(JSON.stringify(s));
    bad.days["2026-11-04"].rounds[0].chart = "nobody-2010";
    expect(checkShotSchedule(bad, CHARTS, "2026-11-03").errors.join(" ")).toContain("nobody-2010");
  });
});

describe("scoring and share", () => {
  it("scores 100 plus a speed bonus for a right guess", () => {
    expect(pointsForGuess(true, 0).total).toBe(200);
    expect(pointsForGuess(true, ROUND_LIMIT_MS).total).toBe(100);
    expect(pointsForGuess(false, 100).total).toBe(0);
  });
  it("shares a spoiler-free target row", () => {
    const t = shareShot({ puzzleNumber: 4, results: [true, true, false, true, false], score: 640, percentile: null });
    expect(t.startsWith("TRIPDUB · Shot Chart #4")).toBe(true);
    expect(t).toContain("🎯🎯❌🎯❌");
    expect(t).toContain("3/5");
  });
});
