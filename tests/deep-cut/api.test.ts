import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const claims = new Map<string, string>();
vi.mock("@/lib/server/db", () => ({
  recordDailyResult: vi.fn(async () => ({ percentile: 0.75, total: 40 })),
  claimOnce: vi.fn(async (key: string, value: string) => {
    const fresh = !claims.has(key);
    if (fresh) claims.set(key, value);
    return { value: claims.get(key)!, fresh };
  }),
}));

import { recordDailyResult } from "@/lib/server/db";
import { POST as start } from "@/app/api/deep-cut/start/route";
import { POST as answer } from "@/app/api/deep-cut/answer/route";
import { POST as next } from "@/app/api/deep-cut/next/route";
import { GET as names } from "@/app/api/deep-cut/names/route";
import { playerName, promptById } from "@/games/deep-cut/server/data";
import { getDeepCutDay } from "@/games/deep-cut/server/puzzle";
import { TIER_POINTS, type Tier } from "@/games/deep-cut/types";
import { addDays, puzzleDate } from "@/lib/day";

process.env.RUN_TOKEN_SECRET = "test-run-secret-abcdefghijklmnop";
const DEVICE = "device-deepcut-01";

const post = async (h: (r: Request) => Promise<Response>, body: unknown) => {
  const res = await h(new Request("http://t/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

/** A valid answer of the given tier for a prompt (test-only peek at the bank). */
function answerOf(promptId: string, tier: Tier = "layup") {
  const entry = Object.entries(promptById(promptId)!.answers).find(([, t]) => t === tier);
  return entry?.[0] ?? Object.keys(promptById(promptId)!.answers)[0];
}

let now = 1_800_000_000_000;
beforeEach(() => {
  claims.clear();
  vi.mocked(recordDailyResult).mockClear();
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

async function playAll(pick: (promptId: string, i: number) => { pid?: string | null; text?: string }) {
  let s = await post(start, { device: DEVICE });
  let token = s.body.token as string;
  let promptId = s.body.prompt.id as string;
  const reveals = [];
  for (let i = 0; i < 7; i++) {
    now += 3000;
    const a = await post(answer, { token, ...pick(promptId, i) });
    expect(a.status).toBe(200);
    reveals.push(a.body);
    token = a.body.token;
    if (i < 6) {
      const n = await post(next, { token });
      expect(n.status).toBe(200);
      token = n.body.token;
      promptId = n.body.prompt.id;
    }
  }
  return reveals;
}

describe("Deep Cut API", () => {
  it("start serves today's first prompt without any answers", async () => {
    const s = await post(start, { device: DEVICE });
    expect(s.status).toBe(200);
    expect(s.body.total).toBe(7);
    expect(s.body.limitMs).toBe(25_000);
    expect(s.body.prompt.id).toBe(getDeepCutDay(puzzleDate()).prompts[0]);
    expect(s.body.prompt.count).toBeGreaterThan(7);
    expect(JSON.stringify(s.body)).not.toMatch(/answers|layup|halfcourt/);
  });

  it("scores a valid answer by its tier and an invalid one as zero", async () => {
    const s = await post(start, { device: DEVICE });
    const id = s.body.prompt.id;
    now += 4000;
    const pid = answerOf(id, "layup");
    const good = await post(answer, { token: s.body.token, pid });
    expect(good.body.valid).toBe(true);
    expect(good.body.tier).toBe(promptById(id)!.answers[pid]);
    expect(good.body.points).toBe(TIER_POINTS[good.body.tier as Tier]);
    expect(good.body.feet).toBe(good.body.points / 10);
    expect(good.body.name).toBe(playerName(pid));

    const s2 = await post(start, { device: DEVICE });
    const wrongPid = ["jordami01", "jamesle01", "curryst01", "duncati01"].find((p) => !promptById(s2.body.prompt.id)!.answers[p])!;
    const bad = await post(answer, { token: s2.body.token, pid: wrongPid });
    expect(bad.body.valid).toBe(false);
    expect(bad.body.points).toBe(0);
  });

  it("accepts an exactly typed name and rejects text that isn't one player", async () => {
    const s = await post(start, { device: DEVICE });
    const pid = answerOf(s.body.prompt.id);
    const typed = await post(answer, { token: s.body.token, text: playerName(pid)!.replace(/\s*\(.*\)$/, "").toUpperCase() });
    expect(typed.body.valid).toBe(true);
    const s2 = await post(start, { device: DEVICE });
    const junk = await post(answer, { token: s2.body.token, text: "zzzz not a player" });
    expect(junk.body.valid).toBe(false);
    expect(junk.body.name).toBeNull();
  });

  it("gives nothing after the buzzer and won't take a second, different answer", async () => {
    const s = await post(start, { device: DEVICE });
    const pid = answerOf(s.body.prompt.id);
    now += 30_000;
    const late = await post(answer, { token: s.body.token, pid });
    expect(late.body.timedOut).toBe(true);
    expect(late.body.points).toBe(0);
    const again = await post(answer, { token: s.body.token, pid: "jordami01" });
    expect(again.status).toBe(409);
  });

  it("finishes the day: total, range, rarest missed answers, percentile and a spoiler-free share", async () => {
    const reveals = await playAll((id, i) => ({ pid: i === 3 ? null : answerOf(id, "layup") }));
    const done = reveals[6].done;
    expect(done.results).toHaveLength(7);
    expect(done.score).toBe(reveals.reduce((s, r) => s + r.points, 0));
    expect(done.feet).toBe(done.score / 10);
    expect(done.results[3].tier).toBeNull();
    for (const r of done.results) {
      expect(r.rare.length).toBeGreaterThan(0);
      expect(r.rare.length).toBeLessThanOrEqual(3);
      expect(r.rare.every((x: { tier: Tier }) => ["halfcourt", "logo", "three"].includes(x.tier))).toBe(true);
    }
    expect(done.percentile).toBe(0.75);
    expect(recordDailyResult).toHaveBeenCalledWith(expect.objectContaining({ game: "deep-cut", score: done.score }));
    expect(done.share).toMatch(/^TRIPDUB · Deep Cut #\d+/);
    for (const r of done.results) if (r.answer) expect(done.share).not.toContain(r.answer);
  });

  it("unlimited games are unscored and archive games replay a past day", async () => {
    const u = await post(start, { device: DEVICE, mode: "unlimited" });
    expect(u.body.mode).toBe("unlimited");
    expect(u.body.puzzleNumber).toBeNull();
    const today = puzzleDate();
    const future = await post(start, { device: DEVICE, mode: "archive", day: addDays(today, 1) });
    expect(future.status).toBe(400);
    const past = addDays(today, -1);
    const a = await post(start, { device: DEVICE, mode: "archive", day: past });
    if (past >= "2026-11-03") {
      expect(a.status).toBe(200);
      expect(a.body.prompt.id).toBe(getDeepCutDay(past).prompts[0]);
    } else {
      expect(a.status).toBe(400);
    }
  });

  it("serves the autocomplete list with names only", async () => {
    const res = await names();
    const list = await res.json();
    expect(list.length).toBeGreaterThan(4000);
    expect(list[0]).toHaveProperty("n");
    expect(JSON.stringify(list.slice(0, 50))).not.toMatch(/layup|halfcourt/);
  });
});
