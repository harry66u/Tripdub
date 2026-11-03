import { describe, expect, it } from "vitest";
import { pointsFor, TIME_LIMIT_MS } from "@/games/trivia/engine/scoring";
import { serveQuestion } from "@/games/trivia/engine/options";
import { shareTrivia } from "@/games/trivia/engine/share";

const q = { id: "q1", q: "Capital of France?", a: ["Paris", "Rome", "Madrid", "Berlin"], cat: "Geography", diff: "easy" as const };

describe("pointsFor", () => {
  it("rewards speed most: 100 for being right plus up to 200 for answering fast", () => {
    expect(pointsFor({ correct: true, ms: 0, pct: null })).toEqual({ base: 100, speed: 200, rarity: 0, total: 300 });
    expect(pointsFor({ correct: true, ms: TIME_LIMIT_MS / 2, pct: null }).speed).toBe(100);
    expect(pointsFor({ correct: true, ms: TIME_LIMIT_MS, pct: null }).speed).toBe(0);
  });
  it("adds a rarity bonus when most players missed it", () => {
    expect(pointsFor({ correct: true, ms: TIME_LIMIT_MS, pct: 0.2 }).rarity).toBe(40);
    expect(pointsFor({ correct: true, ms: TIME_LIMIT_MS, pct: 0.9 }).rarity).toBe(5);
  });
  it("gives nothing for a miss or a timeout", () => {
    expect(pointsFor({ correct: false, ms: 1000, pct: 0.1 }).total).toBe(0);
  });
});

describe("serveQuestion", () => {
  it("shuffles options deterministically and reports where the answer went", () => {
    const a = serveQuestion(q, 42);
    expect(serveQuestion(q, 42)).toEqual(a);
    expect([...a.options].sort()).toEqual([...q.a].sort());
    expect(a.options[a.correctIndex]).toBe("Paris");
    const positions = new Set(Array.from({ length: 40 }, (_, s) => serveQuestion(q, s).correctIndex));
    expect(positions.size).toBeGreaterThan(2);
  });
  it("never includes which option is correct in the served question", () => {
    expect(JSON.stringify(serveQuestion(q, 1).served)).not.toMatch(/correct/i);
  });
});

describe("shareTrivia", () => {
  it("is spoiler-free with an emoji per question", () => {
    const t = shareTrivia({ puzzleNumber: 3, results: [
      { correct: true, ms: 2000 }, { correct: true, ms: 9000 }, { correct: false, ms: 4000 },
      { correct: true, ms: 1000 }, { correct: false, ms: 15000 }, { correct: true, ms: 3000 }, { correct: true, ms: 12000 },
    ], score: 1012, percentile: null });
    expect(t.startsWith("TRIPDUB · NBA Trivia #3")).toBe(true);
    expect(t).toContain("⚡🟩🟥⚡🟥⚡🟩");
    expect(t).toContain("1,012");
    expect(t).not.toContain("Paris");
  });
});
