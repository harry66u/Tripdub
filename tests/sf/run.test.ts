import { describe, expect, it } from "vitest";
import { replay, RunError, type Action } from "@/games/starting-five/engine/run";

const seq = ["p0", "p1", "p2", "p3", "p4", "p5"];
const place = (slot: "PG" | "SG" | "SF" | "PF" | "C"): Action => ({ t: "place", slot });

describe("replay", () => {
  it("starts on the first spin with one re-spin", () => {
    expect(replay(seq, [])).toEqual({ index: 0, currentId: "p0", lineup: {}, respinsLeft: 1, done: false });
  });

  it("re-spin skips to the next player in the shared sequence", () => {
    const v = replay(seq, [{ t: "respin" }]);
    expect(v.currentId).toBe("p1");
    expect(v.respinsLeft).toBe(0);
  });

  it("finishes after five placements", () => {
    const v = replay(seq, [{ t: "respin" }, place("C"), place("PG"), place("SF"), place("SG"), place("PF")]);
    expect(v.done).toBe(true);
    expect(v.currentId).toBeNull();
    expect(v.lineup).toEqual({ C: "p1", PG: "p2", SF: "p3", SG: "p4", PF: "p5" });
  });

  it("finishes without using the re-spin", () => {
    const v = replay(seq, [place("PG"), place("SG"), place("SF"), place("PF"), place("C")]);
    expect(v.done).toBe(true);
    expect(v.respinsLeft).toBe(1);
    expect(v.lineup.C).toBe("p4");
  });

  it("rejects a second re-spin", () => {
    expect(() => replay(seq, [{ t: "respin" }, { t: "respin" }])).toThrow(RunError);
  });

  it("rejects placing into a filled slot", () => {
    expect(() => replay(seq, [place("PG"), place("PG")])).toThrow(RunError);
  });

  it("rejects actions after the lineup is full", () => {
    expect(() =>
      replay(seq, [place("PG"), place("SG"), place("SF"), place("PF"), place("C"), { t: "respin" }]),
    ).toThrow(RunError);
  });

  it("rejects malformed actions", () => {
    expect(() => replay(seq, [{ t: "place", slot: "XX" } as unknown as Action])).toThrow(RunError);
    expect(() => replay(seq, [{ t: "dunk" } as unknown as Action])).toThrow(RunError);
  });
});
