import { describe, expect, it } from "vitest";
import { evaluateMatchup, simulateGame } from "@/games/starting-five/engine/sim";
import { matchupEdge } from "@/games/starting-five/engine/matchup";
import { fixturePlayer, flatTeam, lineupOf } from "./fixtures";

const home = lineupOf(flatTeam(65, "H"));
const away = lineupOf(flatTeam(58, "A"));

describe("play-by-play", () => {
  it("logs every scoring play, in order, ending on the final score", () => {
    const g = simulateGame(home, away, 11, { log: true });
    const plays = g.plays!;
    expect(plays.length).toBeGreaterThan(60);
    const last = plays[plays.length - 1];
    expect([last.h, last.a]).toEqual([g.home.score, g.away.score]);
    for (let i = 1; i < plays.length; i++) {
      const [p, q] = [plays[i - 1], plays[i]];
      expect(q.q > p.q || (q.q === p.q && q.t <= p.t)).toBe(true);
      expect(q.h >= p.h && q.a >= p.a).toBe(true);
    }
  });

  it("doesn't change the game: logging is just a recording", () => {
    const { plays: _plays, ...withLog } = simulateGame(home, away, 11, { log: true });
    expect(withLog).toEqual(simulateGame(home, away, 11));
  });

  it("the featured game comes with its play-by-play", () => {
    expect(evaluateMatchup(home, away, 3, 50).featured.plays?.length).toBeGreaterThan(0);
  });
});

describe("matchupEdge", () => {
  it("favors an elite scorer over a weak defender, and is symmetric", () => {
    const star = fixturePlayer({ r: { sco: 95, spc: 90, per: 60 }, shot: { rim: 0.3, mid: 0.3, three: 0.4 } });
    const meh = fixturePlayer({ r: { sco: 40, spc: 30, per: 30, rim: 30 } });
    const e = matchupEdge(star, meh);
    expect(e.net).toBeGreaterThan(10);
    expect(e.label).toMatch(/edge/i);
    expect(matchupEdge(meh, star).net).toBeCloseTo(-e.net, 5);
    const even = matchupEdge(meh, { ...meh, id: "x" });
    expect(even.label).toBe("Even");
  });
});
