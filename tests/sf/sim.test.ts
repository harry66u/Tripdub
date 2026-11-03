import { describe, expect, it } from "vitest";
import { evaluateMatchup, simulateGame } from "@/games/starting-five/engine/sim";
import { SLOTS, type Lineup } from "@/games/starting-five/types";
import { fixturePlayer, flatTeam, lineupOf } from "./fixtures";

const sumPts = (box: ReturnType<typeof simulateGame>["home"]) =>
  SLOTS.reduce((s, k) => s + box.players[k].pts, 0);

describe("simulateGame", () => {
  const home = lineupOf(flatTeam(60, "H"));
  const away = lineupOf(flatTeam(55, "A"));

  it("is deterministic for a seed", () => {
    expect(simulateGame(home, away, 123)).toEqual(simulateGame(home, away, 123));
  });

  it("credits every point to a player and every quarter", () => {
    for (let s = 0; s < 20; s++) {
      const g = simulateGame(home, away, s);
      expect(sumPts(g.home)).toBe(g.home.score);
      expect(sumPts(g.away)).toBe(g.away.score);
      expect(g.home.quarters.reduce((a, b) => a + b, 0)).toBe(g.home.score);
      expect(g.away.quarters.reduce((a, b) => a + b, 0)).toBe(g.away.score);
      expect(g.home.score).not.toBe(g.away.score);
    }
  });

  it("draws a realistic number of free throws", () => {
    let fta = 0;
    for (let s = 0; s < 50; s++) {
      const g = simulateGame(home, away, s);
      for (const t of [g.home, g.away]) fta += SLOTS.reduce((a, k) => a + t.players[k].fta, 0);
    }
    const perTeam = fta / 100;
    expect(perTeam).toBeGreaterThanOrEqual(16);
    expect(perTeam).toBeLessThanOrEqual(30);
  });

  it("produces realistic scores", () => {
    for (let s = 0; s < 50; s++) {
      const g = simulateGame(home, away, s);
      for (const t of [g.home, g.away]) {
        expect(t.score).toBeGreaterThanOrEqual(70);
        expect(t.score).toBeLessThanOrEqual(160);
      }
    }
  });
});

describe("evaluateMatchup", () => {
  it("strongly favors a much better lineup", () => {
    const ev = evaluateMatchup(lineupOf(flatTeam(85)), lineupOf(flatTeam(40)), 1);
    expect(ev.winProb).toBeGreaterThan(0.9);
    expect(ev.meanMargin).toBeGreaterThan(5);
  });

  it("is a coin flip for identical lineups", () => {
    const t = flatTeam(60);
    const ev = evaluateMatchup(lineupOf(t), lineupOf(t.map((p) => ({ ...p, id: p.id + "b" }))), 2);
    expect(ev.winProb).toBeGreaterThanOrEqual(0.4);
    expect(ev.winProb).toBeLessThanOrEqual(0.6);
  });

  it("makes slot placement matter through matchups", () => {
    const avg = flatTeam(55, "Avg");
    const center = fixturePlayer({
      name: "Big",
      pos: "C",
      heightIn: 85,
      r: { sco: 55, ply: 30, reb: 85, per: 20, rim: 98, spc: 10 },
      shot: { rim: 0.7, mid: 0.3, three: 0 },
    });
    const shooter = fixturePlayer({
      name: "Shooter",
      pos: "PG",
      r: { sco: 90, ply: 60, reb: 20, per: 50, rim: 10, spc: 99 },
      shot: { rim: 0.15, mid: 0.25, three: 0.6 },
      usg: 0.32,
    });
    const away: Lineup = lineupOf([shooter, ...flatTeam(55, "Opp").slice(1)]);
    const centerAtC: Lineup = lineupOf([avg[0], avg[1], avg[2], avg[3], center]);
    const centerAtPG: Lineup = lineupOf([center, avg[1], avg[2], avg[3], avg[0]]);
    // Enough sims that the gap is signal, not noise (sd of the difference is ~0.4 here).
    const a = evaluateMatchup(centerAtC, away, 9, 3000);
    const b = evaluateMatchup(centerAtPG, away, 9, 3000);
    expect(a.meanMargin - b.meanMargin).toBeGreaterThanOrEqual(1.0);
  });

  it("features the median game, consistent with the win probability", () => {
    const pairs: [number, number][] = [
      [70, 55],
      [55, 70],
      [62, 58],
    ];
    for (const [h, a] of pairs) {
      const ev = evaluateMatchup(lineupOf(flatTeam(h)), lineupOf(flatTeam(a)), 5);
      const m = ev.featured.home.score - ev.featured.away.score;
      if (Math.abs(ev.meanMargin) > 2) expect(Math.sign(m)).toBe(Math.sign(ev.meanMargin));
      expect(Math.abs(m - ev.meanMargin)).toBeLessThan(ev.sdMargin);
      expect(simulateGame(lineupOf(flatTeam(h)), lineupOf(flatTeam(a)), ev.featuredSeed)).toEqual(ev.featured);
    }
  });

  it("runs 400 sims quickly", () => {
    const t0 = performance.now();
    evaluateMatchup(lineupOf(flatTeam(70)), lineupOf(flatTeam(65)), 3, 400);
    expect(performance.now() - t0).toBeLessThan(150);
  });
});
