import { describe, expect, it } from "vitest";
import { gradeLineup, letter } from "@/games/starting-five/engine/grades";
import { archetype, clueFor } from "@/games/starting-five/engine/archetype";
import { fixturePlayer } from "./fixtures";

const base = () => Array.from({ length: 5 }, () => fixturePlayer());

describe("gradeLineup", () => {
  it("punishes a lineup with no real playmaker", () => {
    const noPg = base().map((p) => ({ ...p, r: { ...p.r, ply: 40 } }));
    const withPg = noPg.slice();
    withPg[0] = { ...withPg[0], r: { ...withPg[0].r, ply: 95 } };
    expect(gradeLineup(withPg).ply).toBeGreaterThan(gradeLineup(noPg).ply + 15);
  });

  it("punishes a lineup with no rim protector", () => {
    const noRim = base().map((p) => ({ ...p, r: { ...p.r, rim: 30 } }));
    const withRim = noRim.slice();
    withRim[4] = { ...withRim[4], r: { ...withRim[4].r, rim: 95 } };
    expect(gradeLineup(withRim).def).toBeGreaterThan(gradeLineup(noRim).def + 15);
  });

  it("rewards five shooters over two", () => {
    const five = base().map((p) => ({ ...p, r: { ...p.r, spc: 85 } }));
    const two = five.map((p, i) => (i < 2 ? p : { ...p, r: { ...p.r, spc: 20 } }));
    expect(gradeLineup(five).spc).toBeGreaterThan(gradeLineup(two).spc + 25);
  });

  it("weights scoring toward the best scorer", () => {
    const flat = base();
    const star = flat.slice();
    star[0] = { ...star[0], r: { ...star[0].r, sco: 99 } };
    const spread = flat.map((p) => ({ ...p, r: { ...p.r, sco: 60 } }));
    // one 99 + four 50s beats five 60s: the best scorer matters most
    expect(gradeLineup(star).sco).toBeGreaterThan(gradeLineup(spread).sco);
  });

  it("keeps every grade within 0..100", () => {
    for (const v of [0, 1, 50, 99]) {
      const g = gradeLineup(base().map((p) => ({ ...p, r: { sco: v, ply: v, reb: v, per: v, rim: v, spc: v } })));
      for (const k of ["sco", "def", "reb", "spc", "ply", "overall"] as const) {
        expect(g[k]).toBeGreaterThanOrEqual(0);
        expect(g[k]).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("letter", () => {
  it("maps grades to letters", () => {
    expect(letter(95)).toBe("A+");
    expect(letter(86)).toBe("A");
    expect(letter(72)).toBe("B");
    expect(letter(56)).toBe("C");
    expect(letter(41)).toBe("D");
    expect(letter(10)).toBe("F");
  });
});

describe("archetype and clues", () => {
  it("labels an elite passing guard a Floor General", () => {
    expect(archetype(fixturePlayer({ pos: "PG", r: { ply: 97, sco: 80 } }))).toBe("Floor General");
  });
  it("labels a shot-blocking center a Rim Protector", () => {
    expect(archetype(fixturePlayer({ pos: "C", r: { rim: 97, sco: 40, reb: 80 } }))).toBe("Rim Protector");
  });
  it("labels a high-volume shooter a Sharpshooter", () => {
    expect(archetype(fixturePlayer({ pos: "SG", r: { spc: 98, sco: 70, ply: 40 } }))).toBe("Sharpshooter");
  });
  it("gives the decade of the prime", () => {
    expect(clueFor(fixturePlayer({ era: 1990 })).era).toBe("1990s");
  });
});
