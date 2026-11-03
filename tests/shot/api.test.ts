import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const claims = new Map<string, string>();
vi.mock("@/lib/server/db", () => ({
  recordDailyResult: vi.fn(async () => ({ percentile: 0.5, total: 12 })),
  claimOnce: vi.fn(async (key: string, value: string) => {
    const fresh = !claims.has(key);
    if (fresh) claims.set(key, value);
    return { value: claims.get(key)!, fresh };
  }),
}));

import { recordDailyResult } from "@/lib/server/db";
import { POST as start } from "@/app/api/shot/start/route";
import { POST as guess } from "@/app/api/shot/guess/route";
import { POST as next } from "@/app/api/shot/next/route";
import { chartById } from "@/games/shot-chart/server/data";
import { getShotDay } from "@/games/shot-chart/server/puzzle";
import { puzzleDate } from "@/lib/day";

process.env.RUN_TOKEN_SECRET = "test-run-secret-abcdefghijklmnop";
const DEVICE = "device-shot-0001";
const post = async (h: (r: Request) => Promise<Response>, body: unknown) => {
  const res = await h(new Request("http://t/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
let now = 1_800_000_000_000;
beforeEach(() => {
  claims.clear();
  vi.mocked(recordDailyResult).mockClear();
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

const rightIndex = (round: number) => {
  const r = getShotDay(puzzleDate()).rounds[round];
  return r.choices.indexOf(r.chart);
};

describe("shot chart API", () => {
  it("serves the chart and four names, but never the answer, season or team", async () => {
    const s = await post(start, { device: DEVICE });
    expect(s.status).toBe(200);
    const day = getShotDay(puzzleDate());
    const answer = chartById(day.rounds[0].chart)!;
    expect(s.body.round.choices).toHaveLength(4);
    expect(Object.keys(s.body.round.zones)).toHaveLength(12);
    const text = JSON.stringify(s.body);
    expect(text).not.toContain(answer.id);
    expect(text).not.toContain(String(answer.nbaId));
    expect(text).not.toContain(answer.team.name);
    expect(text).not.toContain(`"season"`);
  });

  it("reveals the player after a guess and scores right answers by speed", async () => {
    const s = await post(start, { device: DEVICE });
    now += 4000;
    const g = await post(guess, { token: s.body.token, choice: rightIndex(0) });
    expect(g.body.correct).toBe(true);
    expect(g.body.points.total).toBeGreaterThan(170);
    expect(g.body.answer.name).toBe(chartById(getShotDay(puzzleDate()).rounds[0].chart)!.name);
    expect(g.body.answer.season).toBeGreaterThan(2000);
    const cheat = await post(guess, { token: s.body.token, choice: (rightIndex(0) + 1) % 4 });
    expect(cheat.status).toBe(409);
  });

  it("plays all five rounds and records the daily result", async () => {
    const s = await post(start, { device: DEVICE });
    let token = s.body.token as string;
    let last: { body: { done?: { score: number; share: string } } } | null = null;
    for (let i = 0; i < 5; i++) {
      now += 5000;
      const g = await post(guess, { token, choice: rightIndex(i) });
      if (i === 4) {
        last = g;
        break;
      }
      const n = await post(next, { token: g.body.token });
      expect(n.body.round.index).toBe(i + 1);
      token = n.body.token;
    }
    expect(last!.body.done!.share).toContain("🎯🎯🎯🎯🎯");
    expect(recordDailyResult).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordDailyResult).mock.calls[0][0]).toMatchObject({ game: "shot-chart" });
  });
});
