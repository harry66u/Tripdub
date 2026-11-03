import { describe, expect, it } from "vitest";
import { feetFor, pointsFor, zoneFor, RIM_TO_HALF_COURT_FT } from "@/games/deep-cut/engine/scoring";
import { shareDeepCut, TIER_EMOJI } from "@/games/deep-cut/engine/share";
import { buildIndex, normName, resolveExact, search } from "@/games/deep-cut/engine/match";
import { MAX_SCORE, TIER_POINTS } from "@/games/deep-cut/types";

describe("Deep Cut scoring", () => {
  it("scores each shot range", () => {
    expect(TIER_POINTS).toEqual({ layup: 10, toocute: 15, midrange: 30, three: 60, logo: 85, halfcourt: 100 });
    expect(pointsFor("halfcourt")).toBe(100);
    expect(pointsFor(null)).toBe(0);
    expect(MAX_SCORE).toBe(700);
  });

  it("turns points into feet of range, 10 points a foot", () => {
    expect(feetFor(0)).toBe(0);
    expect(feetFor(85)).toBe(8.5);
    expect(feetFor(700)).toBe(70);
  });

  it("names the spot on the floor", () => {
    expect(zoneFor(0).label).toBe("At the rim");
    expect(zoneFor(20).label).toBe("Midrange");
    expect(zoneFor(25).label).toBe("Three-point range");
    expect(zoneFor(35).label).toBe("Logo range");
    expect(zoneFor(RIM_TO_HALF_COURT_FT + 1).label).toBe("Past half-court");
  });
});

describe("Deep Cut share", () => {
  it("shows tiers and range with no answers", () => {
    const text = shareDeepCut({ puzzleNumber: 4, tiers: ["layup", null, "halfcourt", "three", "midrange", "logo", "toocute"], score: 300, percentile: 0.9 });
    const lines = text.split("\n");
    expect(lines[0]).toBe("TRIPDUB · Deep Cut #4");
    expect(lines[1]).toBe(["layup", null, "halfcourt", "three", "midrange", "logo", "toocute"].map((t) => (t ? TIER_EMOJI[t as keyof typeof TIER_EMOJI] : TIER_EMOJI.miss)).join(""));
    expect(text).toContain("300 pts · 30 ft of range");
    expect(text).toContain("Top 10% today");
    expect(text).not.toMatch(/LeBron|Lakers/);
  });
  it("labels unlimited games", () => {
    expect(shareDeepCut({ puzzleNumber: null, tiers: [], score: 0, percentile: null }).split("\n")[0]).toBe("TRIPDUB · Deep Cut · Unlimited");
  });
});

describe("Deep Cut name matching", () => {
  const index = buildIndex([
    { i: "jamesle01", n: "LeBron James", y: "2003–2026" },
    { i: "jamesbr02", n: "Bronny James", y: "2024–2026" },
    { i: "hardaan01", n: "Anfernee Hardaway", y: "1993–2008", a: ["Penny Hardaway"] },
    { i: "doncilu01", n: "Luka Dončić", y: "2018–2026" },
    { i: "ewingpa01", n: "Patrick Ewing (1985–2002)", y: "1985–2002" },
    { i: "ewingpa02", n: "Patrick Ewing (2008–2011)", y: "2008–2011" },
  ]);

  it("normalizes accents, case and punctuation", () => {
    expect(normName("Luka Dončić")).toBe("luka doncic");
    expect(normName("  Shaquille O'Neal ")).toBe("shaquille oneal");
  });

  it("finds players by any word prefix, most famous first", () => {
    expect(search(index, "jam").map((e) => e.i)).toEqual(["jamesle01", "jamesbr02"]);
    expect(search(index, "lebron")[0].i).toBe("jamesle01");
    expect(search(index, "doncic")[0].i).toBe("doncilu01");
    expect(search(index, "penny")[0].i).toBe("hardaan01");
    expect(search(index, "l")).toEqual([]);
  });

  it("resolves an exact typed name, never an ambiguous one", () => {
    expect(resolveExact(index, "lebron james")?.i).toBe("jamesle01");
    expect(resolveExact(index, "Penny Hardaway")?.i).toBe("hardaan01");
    expect(resolveExact(index, "Patrick Ewing")).toBeNull();
    expect(resolveExact(index, "Michael Jordan")).toBeNull();
  });
});
