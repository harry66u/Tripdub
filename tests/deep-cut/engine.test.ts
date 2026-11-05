import { describe, expect, it } from "vitest";
import { feetFor, pointsFor, zoneFor, RIM_TO_HALF_COURT_FT } from "@/games/deep-cut/engine/scoring";
import { shareDeepCut, TIER_EMOJI } from "@/games/deep-cut/engine/share";
import { buildIndex, normName, resolveGuess } from "@/games/deep-cut/engine/match";
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

describe("Deep Cut name normalizing", () => {
  it("normalizes accents, case and punctuation", () => {
    expect(normName("Luka Dončić")).toBe("luka doncic");
    expect(normName("  Shaquille O'Neal ")).toBe("shaquille oneal");
  });
});

describe("Deep Cut typed guesses", () => {
  const index = buildIndex([
    { i: "jamesle01", n: "LeBron James", y: "2003–2026", f: 100, a: ["Bron"] },
    { i: "jordami01", n: "Michael Jordan", y: "1984–2003", f: 100 },
    { i: "curryst01", n: "Stephen Curry", y: "2009–2026", f: 98, a: ["Steph Curry", "Steph"] },
    { i: "antetgi01", n: "Giannis Antetokounmpo", y: "2013–2026", f: 87 },
    { i: "jordade01", n: "DeAndre Jordan", y: "2008–2025", f: 35 },
    { i: "curryse01", n: "Seth Curry", y: "2013–2026", f: 12 },
    { i: "antetth01", n: "Thanasis Antetokounmpo", y: "2015–2026", f: 3 },
    { i: "jacksja02", n: "Jaren Jackson Jr.", y: "2018–2026", f: 40 },
    { i: "smithjr01", n: "J.R. Smith", y: "2004–2019", f: 36 },
    { i: "smithke01", n: "Kenny Smith", y: "1987–1997", f: 33 },
    { i: "ewingpa01", n: "Patrick Ewing (1985–2002)", y: "1985–2002", f: 72 },
    { i: "ewingpa02", n: "Patrick Ewing (2008–2011)", y: "2008–2011", f: 2 },
    { i: "bryanko01", n: "Kobe Bryant", y: "1996–2016", f: 98 },
    { i: "simmoko01", n: "Kobi Simmons", y: "2017–2020", f: 1 },
    { i: "duranke01", n: "Kevin Durant", y: "2007–2026", f: 90 },
    { i: "westbru01", n: "Russell Westbrook", y: "2008–2026", f: 77 },
    { i: "jokicni01", n: "Nikola Jokić", y: "2015–2026", f: 83 },
    { i: "nowitdi01", n: "Dirk Nowitzki", y: "1998–2019", f: 86 },
    { i: "onealsh01", n: "Shaquille O'Neal", y: "1992–2011", f: 98 },
    { i: "anthoca01", n: "Carmelo Anthony", y: "2003–2022", f: 66 },
    { i: "davisan02", n: "Anthony Davis", y: "2012–2026", f: 63 },
    { i: "edwaran01", n: "Anthony Edwards", y: "2020–2026", f: 60 },
  ]);
  const who = (t: string) => {
    const r = resolveGuess(index, t);
    return r.status === "found" ? r.entry.i : r.status;
  };

  it("takes exact names and aliases", () => {
    expect(who("LeBron James")).toBe("jamesle01");
    expect(who("steph")).toBe("curryst01");
    expect(who("Bron")).toBe("jamesle01");
  });
  it("fixes typos", () => {
    expect(who("lebron jams")).toBe("jamesle01");
    expect(who("Giannis Antetokunmpo")).toBe("antetgi01");
    expect(who("stephen cury")).toBe("curryst01");
  });
  it("lets a famous single name stand alone, but not a shared one", () => {
    expect(who("Curry")).toBe("curryst01");
    expect(who("Jordan")).toBe("jordami01");
    expect(who("Giannis")).toBe("antetgi01");
    expect(who("Smith")).toBe("ambiguous");
  });
  it("picks the famous one of two players with the same name", () => {
    expect(who("Patrick Ewing")).toBe("ewingpa01");
  });
  it("drops Jr. and friends", () => {
    expect(who("Jaren Jackson")).toBe("jacksja02");
  });
  it("rejects what is nobody", () => {
    expect(who("zzzz")).toBe("none");
    expect(who("Sentry")).toBe("none");
    expect(who("")).toBe("none");
  });
  it("corrects typos generously", () => {
    expect(who("Kevn Durnt")).toBe("duranke01");
    expect(who("Russel Westbrok")).toBe("westbru01");
    expect(who("Shaquile Oneal")).toBe("onealsh01");
    expect(who("Lebrom")).toBe("jamesle01");
  });
  it("hears sound-alike spellings", () => {
    expect(who("Steven Curry")).toBe("curryst01");
    expect(who("Jokich")).toBe("jokicni01");
    expect(who("Dirk Nowitsky")).toBe("nowitdi01");
  });
  it("forgives missing spaces, swapped order and cut-off names", () => {
    expect(who("lebronjames")).toBe("jamesle01");
    expect(who("James LeBron")).toBe("jamesle01");
    expect(who("Antetok")).toBe("antetgi01");
    expect(who("Westbr")).toBe("westbru01");
  });
  it("leans toward the famous player a slip most likely meant", () => {
    expect(who("Kobi")).toBe("bryanko01");
    expect(who("Kobi Simmons")).toBe("simmoko01");
  });
  it("still asks when several well-known players fit", () => {
    expect(who("Anthony")).toBe("ambiguous");
    expect(who("Smith")).toBe("ambiguous");
  });
});

