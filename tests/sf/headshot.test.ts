import { describe, expect, it } from "vitest";
import { headshotCandidates } from "@/components/starting-five/headshot-urls";

describe("headshotCandidates", () => {
  it("tries that season's team photo before the latest one", () => {
    const urls = headshotCandidates({ nbaId: 201939, season: 2016, team: { abbr: "GSW", name: "Golden State Warriors" } }, "sm");
    expect(urls[0]).toContain("/1610612744/2015/");
    expect(urls[0]).toContain("/201939.png");
    expect(urls.at(-1)).toBe("https://cdn.nba.com/headshots/nba/latest/260x190/201939.png");
  });
  it("maps historical teams to their franchise", () => {
    const urls = headshotCandidates({ nbaId: 2544, season: 2016, team: { abbr: "SEA", name: "Seattle SuperSonics" } }, "lg");
    expect(urls[0]).toContain("/1610612760/2015/");
  });
  it("goes straight to the latest photo for seasons NBA.com has no team photos for", () => {
    expect(headshotCandidates({ nbaId: 977, season: 2006, team: { abbr: "LAL", name: "Los Angeles Lakers" } }, "lg")).toEqual([
      "https://cdn.nba.com/headshots/nba/latest/1040x760/977.png",
    ]);
  });
  it("has nothing to try without an NBA.com id", () => {
    expect(headshotCandidates({ nbaId: null, season: 2016, team: { abbr: "GSW", name: "Golden State Warriors" } }, "sm")).toEqual([]);
  });
});
