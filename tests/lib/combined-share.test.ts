import { describe, expect, it } from "vitest";
import { combinedShare } from "@/lib/client/combined-share";

describe("combinedShare", () => {
  it("rolls the three daily shares into one spoiler-free Tripdub line-up", () => {
    const text = combinedShare(5, {
      sf: { summary: "W 118–109", share: "TRIPDUB · Starting Five #5\nW 118–109 vs the Twin Towers · Win prob 78%\nSCO 🟩 DEF 🟨 REB 🟧 SPC 🟩 PLY 🟩\ntripdub.app" },
      trivia: { summary: "5/7", share: "TRIPDUB · NBA Trivia #5\n⚡🟩🟥⚡🟩🟩⚡\n6/7 right · 1,820 pts\ntripdub.app" },
      shot: { summary: "4/5", share: "TRIPDUB · Shot Chart #5\n🎯🎯❌🎯🎯\n4/5 · 740 pts\ntripdub.app" },
    });
    expect(text.split("\n")[0]).toBe("TRIPDUB #5 · All three done");
    expect(text).toContain("Starting Five: W 118–109 vs the Twin Towers · Win prob 78%");
    expect(text).toContain("NBA Trivia: ⚡🟩🟥⚡🟩🟩⚡ 6/7 right · 1,820 pts");
    expect(text).toContain("Shot Chart: 🎯🎯❌🎯🎯 4/5 · 740 pts");
    expect(text.trim().endsWith("tripdub.app")).toBe(true);
  });
});
