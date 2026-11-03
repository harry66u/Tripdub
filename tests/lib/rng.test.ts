import { describe, expect, it } from "vitest";
import { hashSeed, rng } from "@/lib/rng";

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays within [0, 1)", () => {
    const r = rng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs across seeds", () => {
    expect(rng(1)()).not.toBe(rng(2)());
  });
});

describe("hashSeed", () => {
  it("is stable and order-sensitive", () => {
    expect(hashSeed("sf", "2026-11-03")).toBe(hashSeed("sf", "2026-11-03"));
    expect(hashSeed("sf", "2026-11-03")).not.toBe(hashSeed("2026-11-03", "sf"));
    expect(Number.isInteger(hashSeed("x", 1))).toBe(true);
  });
});
