import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db", () => ({
  recordDailyResult: vi.fn(async () => ({ percentile: 0.75, total: 41 })),
}));
// The first few finishers shouldn't brag "Top 1%": covered in shareForResult tests below.

import { recordDailyResult } from "@/lib/server/db";
import { POST as start } from "@/app/api/sf/daily/start/route";
import { POST as step } from "@/app/api/sf/daily/step/route";
import { POST as finish } from "@/app/api/sf/daily/finish/route";
import { getSFPuzzle } from "@/games/starting-five/server/puzzle";
import { puzzleDate } from "@/lib/day";
import { SLOTS } from "@/games/starting-five/types";

process.env.RUN_TOKEN_SECRET = "test-run-secret-abcdefghijklmnop";
const DEVICE = "device-test-0001";

const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(new Request("http://test.local/api", { method: "POST", body: JSON.stringify(body) }));

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

async function playThrough(actions: unknown[]) {
  let { body } = await json(await post(start, { device: DEVICE }));
  for (const action of actions) {
    const r = await json(await post(step, { token: body.token, action }));
    expect(r.status).toBe(200);
    body = r.body;
  }
  return body.token as string;
}

const FIVE = SLOTS.map((slot) => ({ t: "place", slot }));

describe("daily Starting Five API", () => {
  beforeEach(() => vi.mocked(recordDailyResult).mockClear());

  it("start shows the opposing five but only the first spin", async () => {
    const { status, body } = await json(await post(start, { device: DEVICE }));
    expect(status).toBe(200);
    const puzzle = getSFPuzzle(puzzleDate());
    expect(body.mode).toBe("daily");
    expect(body.current.id).toBe(puzzle.spins[0]);
    for (const s of SLOTS) expect(body.opponent[s].id).toBe(puzzle.mystery[s]);
    const text = JSON.stringify(body);
    for (const id of puzzle.spins.slice(1)) expect(text).not.toContain(id);
    expect(Object.keys(body.clues).sort()).toEqual([...SLOTS].sort());
  });

  it("unlimited games deal a fresh puzzle each time and are never recorded", async () => {
    const a = await json(await post(start, { device: DEVICE, mode: "unlimited" }));
    const b = await json(await post(start, { device: DEVICE, mode: "unlimited" }));
    expect(a.body.mode).toBe("unlimited");
    const ids = (x: typeof a) => [x.body.current.id, ...SLOTS.map((s) => x.body.opponent[s].id)].join();
    expect(ids(a)).not.toBe(ids(b));
    let token = a.body.token;
    for (const action of FIVE) token = (await json(await post(step, { token, action }))).body.token;
    const done = await json(await post(finish, { token }));
    expect(done.status).toBe(200);
    expect(done.body.mode).toBe("unlimited");
    expect(done.body.percentile).toBeNull();
    expect(recordDailyResult).not.toHaveBeenCalled();
  });

  it("rejects an unknown mode", async () => {
    expect((await post(start, { device: DEVICE, mode: "ranked" })).status).toBe(400);
  });

  it("rejects a bad device id", async () => {
    expect((await post(start, { device: "x" })).status).toBe(400);
  });

  it("re-spin brings up a different player", async () => {
    const s = await json(await post(start, { device: DEVICE }));
    const r = await json(await post(step, { token: s.body.token, action: { t: "respin" } }));
    expect(r.status).toBe(200);
    expect(r.body.current.id).not.toBe(s.body.current.id);
    expect(r.body.view.respinsLeft).toBe(0);
  });

  it("rejects an illegal action and a forged token", async () => {
    const s = await json(await post(start, { device: DEVICE }));
    const t1 = (await json(await post(step, { token: s.body.token, action: { t: "place", slot: "PG" } }))).body.token;
    expect((await post(step, { token: t1, action: { t: "place", slot: "PG" } })).status).toBe(400);
    expect((await post(step, { token: t1.slice(0, -3) + "abc", action: { t: "respin" } })).status).toBe(400);
  });

  it("refuses to finish an incomplete lineup", async () => {
    const token = await playThrough(FIVE.slice(0, 3));
    expect((await post(finish, { token })).status).toBe(400);
    expect(recordDailyResult).not.toHaveBeenCalled();
  });

  it("finishes with a full result, and finishing twice is identical", async () => {
    const token = await playThrough([{ t: "respin" }, ...FIVE]);
    const a = await json(await post(finish, { token }));
    const b = await json(await post(finish, { token }));
    expect(a.status).toBe(200);
    expect(a.body.winProb).toBeGreaterThan(0);
    expect(a.body.winProb).toBeLessThan(1);
    expect(a.body.featured.home.score).toBeGreaterThan(50);
    expect(a.body.percentile).toBe(0.75);
    expect(a.body.share).toContain("Top 25%");
    expect(a.body.opponent.PG.name).toBeTruthy();
    expect(b.body.winProb).toBe(a.body.winProb);
    expect(vi.mocked(recordDailyResult).mock.calls[0]).toEqual(vi.mocked(recordDailyResult).mock.calls[1]);
    const call = vi.mocked(recordDailyResult).mock.calls[0][0];
    expect(call).toMatchObject({ game: "starting-five", date: puzzleDate(), device: DEVICE });
  });
});

import { rankFor } from "@/games/starting-five/server/finish";

describe("rankFor", () => {
  it("hides the percentile until enough players have finished", () => {
    expect(rankFor({ percentile: 1, total: 1 })).toEqual({ percentile: null, total: 1 });
    expect(rankFor({ percentile: 0.6, total: 5 })).toEqual({ percentile: 0.6, total: 5 });
    expect(rankFor(null)).toEqual({ percentile: null, total: null });
  });
});
