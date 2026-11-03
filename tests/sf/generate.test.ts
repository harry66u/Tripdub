import { describe, expect, it } from "vitest";
import { generateSFPuzzle, THEMES } from "@/games/starting-five/server/generate";
import { checkSchedule, fillSchedule, type SFSchedule } from "@/games/starting-five/server/schedule";
import { POOL } from "@/games/starting-five/server/data";
import { addDays } from "@/lib/day";
import { pidOf, SLOTS } from "@/games/starting-five/types";

describe("generateSFPuzzle", () => {
  it("is deterministic for a date", () => {
    expect(generateSFPuzzle("2026-12-25", POOL, new Set())).toEqual(generateSFPuzzle("2026-12-25", POOL, new Set()));
  });

  it("varies by date", () => {
    expect(generateSFPuzzle("2026-12-25", POOL, new Set()).spins).not.toEqual(
      generateSFPuzzle("2026-12-26", POOL, new Set()).spins,
    );
  });

  it("never uses the same player twice in one day, even as different seasons", () => {
    for (let i = 0; i < 30; i++) {
      const p = generateSFPuzzle(addDays("2026-11-03", i), POOL, new Set());
      expect(p.spins).toHaveLength(6);
      const pids = [...p.spins, ...SLOTS.map((s) => p.mystery[s])].map(pidOf);
      expect(new Set(pids).size).toBe(11);
      expect(THEMES.map((t) => t.name)).toContain(p.theme);
    }
  });

  it("leans toward recent seasons", () => {
    const seasons: number[] = [];
    for (let i = 0; i < 120; i++) {
      for (const id of generateSFPuzzle(addDays("2027-01-01", i), POOL, new Set()).spins) {
        seasons.push(Number(id.slice(id.lastIndexOf("-") + 1)));
      }
    }
    const share = (pred: (s: number) => boolean) => seasons.filter(pred).length / seasons.length;
    expect(share((s) => s >= 2005)).toBeGreaterThanOrEqual(0.65);
    expect(share((s) => s < 1980)).toBeLessThanOrEqual(0.04);
  });

  it("gives a different puzzle for a different salt (unlimited games)", () => {
    const a = generateSFPuzzle("2026-12-25", POOL, new Set(), "game-a");
    const b = generateSFPuzzle("2026-12-25", POOL, new Set(), "game-b");
    expect(a.spins).not.toEqual(b.spins);
  });

  it("respects the recent-players exclusion", () => {
    const first = generateSFPuzzle("2027-01-01", POOL, new Set());
    const again = generateSFPuzzle("2027-01-01", POOL, new Set(first.spins.map(pidOf)));
    expect(again.spins.map(pidOf).some((pid) => first.spins.map(pidOf).includes(pid))).toBe(false);
  });
});

describe("schedule", () => {
  const schedule: SFSchedule = { version: 1, days: {} };
  fillSchedule(schedule, POOL, "2026-11-03", 120);

  it("fills consecutive days without repeating a spun player within 45 days", () => {
    const dates = Object.keys(schedule.days).sort();
    expect(dates).toHaveLength(120);
    for (let i = 0; i < dates.length; i++) {
      const seen = new Set<string>();
      for (let j = Math.max(0, i - 44); j < i; j++) schedule.days[dates[j]].spins.forEach((id) => seen.add(pidOf(id)));
      expect(schedule.days[dates[i]].spins.some((id) => seen.has(pidOf(id)))).toBe(false);
    }
  });

  it("never overwrites an existing day", () => {
    const s: SFSchedule = { version: 1, days: { "2026-11-05": { ...schedule.days["2026-11-05"], theme: "Edited" } } };
    fillSchedule(s, POOL, "2026-11-03", 5);
    expect(s.days["2026-11-05"].theme).toBe("Edited");
    expect(Object.keys(s.days)).toHaveLength(5);
  });

  it("passes the checker, which catches unknown ids", () => {
    expect(checkSchedule(schedule, POOL, "2026-11-03").errors).toEqual([]);
    const bad: SFSchedule = JSON.parse(JSON.stringify(schedule));
    bad.days["2026-11-04"].spins[0] = "nobody99";
    expect(checkSchedule(bad, POOL, "2026-11-03").errors.join(" ")).toContain("nobody99");
  });

  it("warns when the schedule is about to run out", () => {
    const short: SFSchedule = { version: 1, days: {} };
    fillSchedule(short, POOL, "2026-11-03", 10);
    expect(checkSchedule(short, POOL, "2026-11-03").warnings.join(" ")).toMatch(/runs out/i);
  });
});
