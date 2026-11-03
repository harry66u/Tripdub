import { describe, expect, it } from "vitest";
import { isTripdub, streaks } from "@/lib/client/progress";

const done = { summary: "x", share: "y" };

describe("streaks", () => {
  it("counts consecutive played days ending today or yesterday", () => {
    const all = { "2026-11-01": { sf: done }, "2026-11-02": { trivia: done }, "2026-11-03": { shot: done } };
    expect(streaks(all, "2026-11-03").current).toBe(3);
    expect(streaks(all, "2026-11-04").current).toBe(3); // today not played yet: streak still alive
    expect(streaks(all, "2026-11-05").current).toBe(0);
  });
  it("counts Tripdub days (all three games)", () => {
    const all = { "2026-11-03": { sf: done, trivia: done, shot: done }, "2026-11-02": { sf: done } };
    expect(streaks(all, "2026-11-03").tripdubs).toBe(1);
    expect(isTripdub(all["2026-11-03"])).toBe(true);
    expect(isTripdub(all["2026-11-02"])).toBe(false);
  });
});
