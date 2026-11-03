import { describe, expect, it } from "vitest";
import { evaluateMatchup } from "@/games/starting-five/engine/sim";
import { summarize } from "@/games/starting-five/engine/summary";
import { formatLine, formatPrime, topPercent } from "@/games/starting-five/engine/format";
import { shareText } from "@/games/starting-five/engine/share";
import { gradeLineup } from "@/games/starting-five/engine/grades";
import { SLOTS } from "@/games/starting-five/types";
import { fixturePlayer, flatTeam, lineupOf } from "./fixtures";

const home = lineupOf(flatTeam(68, "Home"));
const away = lineupOf(flatTeam(60, "Away"));
const ev = evaluateMatchup(home, away, 77);

describe("summarize", () => {
  const text = summarize(ev, home, away, { home: "Your five", away: "the Mystery Five" });
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);

  it("has 3 or 4 sentences", () => {
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences.length).toBeLessThanOrEqual(4);
  });

  it("states the final score", () => {
    expect(text).toContain(String(ev.featured.home.score));
    expect(text).toContain(String(ev.featured.away.score));
  });

  it("names the game's top scorer", () => {
    const all = [
      ...SLOTS.map((s) => ({ name: home[s].name, pts: ev.featured.home.players[s].pts })),
      ...SLOTS.map((s) => ({ name: away[s].name, pts: ev.featured.away.players[s].pts })),
    ].sort((a, b) => b.pts - a.pts);
    expect(text).toContain(all[0].name);
  });
});

describe("formatLine", () => {
  it("shows untracked stats as a dash and percentages without the leading zero", () => {
    const p = fixturePlayer({
      line: { pts: 37.9, reb: 24.2, ast: 4.8, stl: null, blk: null, fg3Pct: null, fg3a: null, ftPct: 0.547, tsPct: 0.553 },
    });
    const f = formatLine(p.line);
    expect(f.find((x) => x.label === "STL")?.value).toBe("—");
    expect(f.find((x) => x.label === "3P%")?.value).toBe("—");
    expect(f.find((x) => x.label === "FT%")?.value).toBe(".547");
    expect(f.find((x) => x.label === "PTS")?.value).toBe("37.9");
    expect(f.some((x) => /null|undefined|NaN/.test(x.value))).toBe(false);
  });

  it("formats the prime span as start year to end year", () => {
    expect(formatPrime({ from: 1988, to: 1993 })).toBe("1987–93");
    expect(formatPrime({ from: 2000, to: 2000 })).toBe("1999–00");
  });

  it("converts a percentile to a top-percent", () => {
    expect(topPercent(0.88)).toBe(12);
    expect(topPercent(1)).toBe(1);
    expect(topPercent(0)).toBe(100);
  });
});

describe("shareText", () => {
  const text = shareText({
    puzzleNumber: 12,
    won: true,
    homeScore: 118,
    awayScore: 109,
    winProb: 0.784,
    grades: gradeLineup(Object.values(home)),
    percentile: 0.88,
  });

  it("starts with the brand line", () => {
    expect(text.startsWith("TRIPDUB · Starting Five #12")).toBe(true);
  });

  it("includes the result, win probability, and percentile", () => {
    expect(text).toContain("W 118–109");
    expect(text).toContain("78%");
    expect(text).toContain("Top 12%");
  });

  it("is spoiler-free", () => {
    for (const s of SLOTS) {
      expect(text).not.toContain(home[s].name);
      expect(text).not.toContain(away[s].name);
    }
  });

  it("omits the percentile line when unknown", () => {
    const t = shareText({ puzzleNumber: 1, won: false, homeScore: 100, awayScore: 104, winProb: 0.3, grades: gradeLineup(Object.values(home)), percentile: null });
    expect(t).not.toContain("Top");
    expect(t).toContain("L 100–104");
  });
});
