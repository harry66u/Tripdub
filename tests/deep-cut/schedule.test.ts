import { describe, expect, it } from "vitest";
import { PROMPTS } from "@/games/deep-cut/server/data";
import { familyCap, generateDeepCutDay } from "@/games/deep-cut/server/generate";
import { checkDeepCutSchedule, fillDeepCutSchedule, type DCSchedule } from "@/games/deep-cut/server/schedule";
import { getDeepCutDay } from "@/games/deep-cut/server/puzzle";
import { addDays } from "@/lib/day";

const byId = new Map(PROMPTS.map((p) => [p.id, p]));

describe("generateDeepCutDay", () => {
  it("deals 3 general and 4 specific prompts, easier first", () => {
    for (let i = 0; i < 30; i++) {
      const d = generateDeepCutDay(addDays("2026-11-03", i), PROMPTS, new Map(), String(i));
      const ps = d.prompts.map((id) => byId.get(id)!);
      expect(ps).toHaveLength(7);
      expect(new Set(d.prompts).size).toBe(7);
      expect(ps.filter((p) => p.kind === "general")).toHaveLength(3);
      expect(ps.filter((p) => p.kind === "specific")).toHaveLength(4);
      for (let k = 1; k < ps.length; k++) expect(ps[k].ease).toBeLessThanOrEqual(ps[k - 1].ease);
    }
  });

  it("never asks about the same team twice in a day, and caps each prompt family by its size", () => {
    const pool = (k: string) => PROMPTS.filter((p) => p.kind === k);
    for (let i = 0; i < 60; i++) {
      const ps = generateDeepCutDay("2027-02-01", PROMPTS, new Map(), `s${i}`).prompts.map((id) => byId.get(id)!);
      const tags = ps.flatMap((p) => p.tags);
      expect(new Set(tags).size).toBe(tags.length);
      for (const p of ps) {
        const same = ps.filter((q) => q.fam === p.fam).length;
        const fam = pool(p.kind).filter((q) => q.fam === p.fam).length;
        expect(same).toBeLessThanOrEqual(familyCap(fam, pool(p.kind).length, p.kind === "general" ? 3 : 4));
      }
    }
    expect(familyCap(146, 246, 4)).toBe(3);
    expect(familyCap(6, 150, 3)).toBe(1);
  });

  it("is deterministic per date and differs per salt", () => {
    expect(generateDeepCutDay("2026-11-03", PROMPTS, new Map())).toEqual(generateDeepCutDay("2026-11-03", PROMPTS, new Map()));
    expect(generateDeepCutDay("2026-11-03", PROMPTS, new Map(), "a").prompts).not.toEqual(generateDeepCutDay("2026-11-03", PROMPTS, new Map(), "b").prompts);
  });
});

describe("Deep Cut schedule", () => {
  it("fills days without repeating a prompt until the bank runs dry", () => {
    const s: DCSchedule = { version: 1, days: {} };
    const added = fillDeepCutSchedule(s, PROMPTS, "2026-11-03", 40);
    expect(added).toHaveLength(40);
    const all = Object.values(s.days).flatMap((d) => d.prompts);
    expect(new Set(all).size).toBe(all.length);
    expect(checkDeepCutSchedule(s, PROMPTS, "2026-11-03").errors).toEqual([]);
  });

  it("keeps hand edits and flags bad ids", () => {
    const s: DCSchedule = { version: 1, days: { "2026-11-03": { prompts: ["pick-1", "nope"] } } };
    fillDeepCutSchedule(s, PROMPTS, "2026-11-03", 2);
    expect(s.days["2026-11-03"].prompts).toEqual(["pick-1", "nope"]);
    const { errors } = checkDeepCutSchedule(s, PROMPTS, "2026-11-03");
    expect(errors.join("\n")).toMatch(/needs 7 prompts/);
    expect(errors.join("\n")).toMatch(/unknown prompt "nope"/);
  });

  it("serves 7 real prompts for any date, even if the schedule names a removed prompt", () => {
    const d = getDeepCutDay("2026-11-03");
    expect(d.prompts).toHaveLength(7);
    for (const id of d.prompts) expect(byId.has(id)).toBe(true);
    expect(getDeepCutDay("2031-01-01").prompts).toHaveLength(7);
  });
});
