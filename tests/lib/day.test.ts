import { describe, expect, it } from "vitest";
import { addDays, nextResetAt, puzzleDate, puzzleNumber } from "@/lib/day";

describe("puzzle day (America/New_York)", () => {
  it("rolls over at midnight Eastern, not UTC", () => {
    expect(puzzleDate(new Date("2026-11-04T04:59:00Z"))).toBe("2026-11-03");
    expect(puzzleDate(new Date("2026-11-04T05:00:00Z"))).toBe("2026-11-04");
  });

  it("handles daylight saving time", () => {
    expect(puzzleDate(new Date("2027-07-01T03:59:00Z"))).toBe("2027-06-30");
    expect(puzzleDate(new Date("2027-07-01T04:00:00Z"))).toBe("2027-07-01");
  });

  it("computes the next reset instant", () => {
    expect(nextResetAt(new Date("2026-11-03T15:00:00Z")).toISOString()).toBe("2026-11-04T05:00:00.000Z");
    expect(nextResetAt(new Date("2027-06-30T15:00:00Z")).toISOString()).toBe("2027-07-01T04:00:00.000Z");
    // Day DST ends (2026-11-01): reset at next midnight EST
    expect(nextResetAt(new Date("2026-11-01T12:00:00Z")).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("numbers puzzles from launch day", () => {
    expect(puzzleNumber("2026-11-03")).toBe(1);
    expect(puzzleNumber("2026-11-04")).toBe(2);
    expect(puzzleNumber("2027-11-03")).toBe(366);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
});
