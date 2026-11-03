import { describe, expect, it } from "vitest";
import { BANK } from "@/games/trivia/server/data";
import { generateTriviaDay } from "@/games/trivia/server/generate";
import { checkTriviaSchedule, fillTriviaSchedule, type TriviaSchedule } from "@/games/trivia/server/schedule";

const diffOf = new Map(BANK.map((q) => [q.id, q.diff]));

describe("generateTriviaDay", () => {
  it("deals 7 questions rising in difficulty: 2 easy, 3 medium, 2 hard", () => {
    const d = generateTriviaDay("2026-11-03", BANK, new Map());
    expect(d.questions.map((id) => diffOf.get(id))).toEqual(["easy", "easy", "medium", "medium", "medium", "hard", "hard"]);
    expect(new Set(d.questions).size).toBe(7);
  });
  it("is deterministic per date and differs per salt", () => {
    expect(generateTriviaDay("2026-11-03", BANK, new Map())).toEqual(generateTriviaDay("2026-11-03", BANK, new Map()));
    expect(generateTriviaDay("2026-11-03", BANK, new Map(), "a").questions).not.toEqual(
      generateTriviaDay("2026-11-03", BANK, new Map(), "b").questions,
    );
  });
});

describe("trivia schedule", () => {
  const s: TriviaSchedule = { version: 1, days: {} };
  fillTriviaSchedule(s, BANK, "2026-11-03", 200);

  it("never repeats a question while unused ones remain", () => {
    const all = Object.values(s.days).flatMap((d) => d.questions);
    expect(new Set(all).size).toBe(all.length);
  });

  it("passes the checker and catches unknown ids", () => {
    expect(checkTriviaSchedule(s, BANK, "2026-11-03").errors).toEqual([]);
    const bad: TriviaSchedule = JSON.parse(JSON.stringify(s));
    bad.days["2026-11-05"].questions[0] = "qnope";
    expect(checkTriviaSchedule(bad, BANK, "2026-11-03").errors.join(" ")).toContain("qnope");
  });

  it("keeps going past the end of the bank by reusing the oldest questions", () => {
    const long: TriviaSchedule = { version: 1, days: {} };
    fillTriviaSchedule(long, BANK, "2026-11-03", 400);
    expect(Object.keys(long.days)).toHaveLength(400);
    expect(checkTriviaSchedule(long, BANK, "2026-11-03").warnings.join(" ")).toMatch(/repeat/i);
  });
});
