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
import { NAME_INDEX, playerName, promptById } from "@/games/deep-cut/server/data";
import { resolveGuess } from "@/games/deep-cut/engine/match";
import { getDeepCutDay } from "@/games/deep-cut/server/puzzle";
import { LEAD_MS, MAX_TRIES } from "@/games/deep-cut/server/run";
import { TIER_POINTS, type Tier } from "@/games/deep-cut/types";
import { addDays, puzzleDate } from "@/lib/day";

process.env.RUN_TOKEN_SECRET = "test-run-secret-abcdefghijklmnop";
const DEVICE = "device-deepcut-01";

const post = async (h: (r: Request) => Promise<Response>, body: unknown) => {
  const res = await h(new Request("http://t/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

/** The typed name of a valid answer that the resolver maps straight back to that player. */
function validName(promptId: string, tier?: Tier) {
  const p = promptById(promptId)!;
  for (const [pid, t] of Object.entries(p.answers)) {
    if (tier && t !== tier) continue;
    const name = playerName(pid)!.replace(/\s*\(.*\)$/, "");
    const g = resolveGuess(NAME_INDEX, name);
    if (g.status === "found" && g.entry.i === pid) return { pid, name, tier: t };
  }
  throw new Error(`no typeable answer for ${promptId}`);
}
/** A real, unambiguous player who is NOT valid for the prompt. */
function wrongName(promptId: string) {
  const p = promptById(promptId)!;
  return ["Michael Jordan", "LeBron James", "Stephen Curry", "Tim Duncan", "Brian Scalabrine", "Manute Bol"].find((n) => {
    const g = resolveGuess(NAME_INDEX, n);
    return g.status === "found" && !p.answers[g.entry.i];
  })!;
}

let now = 1_800_000_000_000;
beforeEach(() => {
  claims.clear();
  vi.mocked(recordDailyResult).mockClear();
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

async function begin(body: Record<string, unknown> = {}) {
  const s = await post(start, { device: DEVICE, ...body });
  now += LEAD_MS + 2000;
  return s;
}

describe("Deep Cut API", () => {
  it("start serves today's first prompt with a read-in, and no answers", async () => {
    const s = await post(start, { device: DEVICE });
    expect(s.status).toBe(200);
    expect(s.body.total).toBe(7);
    expect(s.body.limitMs).toBe(25_000);
    expect(s.body.leadMs).toBe(LEAD_MS);
    expect(s.body.prompt.id).toBe(getDeepCutDay(puzzleDate()).prompts[0]);
    expect(s.body.prompt.count).toBeGreaterThan(7);
    expect(JSON.stringify(s.body)).not.toMatch(/answers|layup|halfcourt/);
  });

  it("scores a typed valid answer by its tier, fixing a typo", async () => {
    const s = await begin();
    const v = validName(s.body.prompt.id);
    const typo = v.name.slice(0, -1) + (v.name.endsWith("e") ? "a" : "e");
    const a = await post(answer, { token: s.body.token, text: v.name.length >= 9 ? typo : v.name });
    expect(a.body.status).toBe("scored");
    expect(a.body.valid).toBe(true);
    expect(a.body.name).toBe(playerName(v.pid));
    expect(a.body.points).toBe(TIER_POINTS[v.tier]);
    expect(a.body.feet).toBe(a.body.points / 10);
  });

  it("rejects a wrong answer, keeps the prompt open, then takes a right one", async () => {
    const s = await begin();
    const id = s.body.prompt.id;
    const r1 = await post(answer, { token: s.body.token, text: wrongName(id) });
    expect(r1.body.status).toBe("rejected");
    expect(r1.body.reason).toBe("nope");
    expect(r1.body.tries).toBe(1);
    expect(JSON.stringify(r1.body)).not.toMatch(/tier|points/);
    const r2 = await post(answer, { token: r1.body.token, text: "zzzz qqqq" });
    expect(r2.body.status).toBe("rejected");
    const ok = await post(answer, { token: r2.body.token, text: validName(id).name });
    expect(ok.body.status).toBe("scored");
    expect(ok.body.valid).toBe(true);
  });

  it("asks for more when a name is shared", async () => {
    const s = await begin();
    const r = await post(answer, { token: s.body.token, text: "Smith" });
    expect(r.body).toMatchObject({ status: "rejected", reason: "ambiguous" });
  });

  it("each token takes one shot: a used token can't be re-aimed", async () => {
    const s = await begin();
    const id = s.body.prompt.id;
    const r1 = await post(answer, { token: s.body.token, text: wrongName(id) });
    expect(r1.body.status).toBe("rejected");
    const again = await post(answer, { token: s.body.token, text: validName(id).name });
    expect(again.status).toBe(409);
  });

  it("a pass or the buzzer scores zero and moves on; too many misses ends the prompt", async () => {
    const s = await begin();
    const p = await post(answer, { token: s.body.token, pass: true });
    expect(p.body).toMatchObject({ status: "scored", passed: true, points: 0 });

    const s2 = await begin();
    now += 40_000;
    const late = await post(answer, { token: s2.body.token, text: validName(s2.body.prompt.id).name });
    expect(late.body).toMatchObject({ status: "scored", timedOut: true, points: 0 });

    const s4 = await begin();
    const buzz = await post(answer, { token: s4.body.token, buzzer: true });
    expect(buzz.body).toMatchObject({ status: "scored", timedOut: true, passed: false, points: 0 });

    const s3 = await begin();
    let token = s3.body.token;
    let last;
    for (let i = 0; i < MAX_TRIES; i++) {
      last = await post(answer, { token, text: `nobody${"x".repeat(i)}` });
      token = last.body.token;
    }
    expect(last!.body).toMatchObject({ status: "scored", outOfTries: true, points: 0 });
  });

  it("finishes the day: total, range, rarest missed answers, percentile and a spoiler-free share", async () => {
    const s = await begin();
    let token = s.body.token as string;
    let id = s.body.prompt.id as string;
    const reveals = [];
    for (let i = 0; i < 7; i++) {
      const a = await post(answer, i === 3 ? { token, pass: true } : { token, text: validName(id, "layup").name });
      expect(a.body.status).toBe("scored");
      reveals.push(a.body);
      token = a.body.token;
      if (i < 6) {
        const n = await post(next, { token });
        expect(n.status).toBe(200);
        now += LEAD_MS + 1500;
        token = n.body.token;
        id = n.body.prompt.id;
      }
    }
    const done = reveals[6].done;
    expect(done.results).toHaveLength(7);
    expect(done.score).toBe(reveals.reduce((t, r) => t + r.points, 0));
    expect(done.feet).toBe(done.score / 10);
    expect(done.results[3].tier).toBeNull();
    for (const r of done.results) {
      expect(r.rare.length).toBeGreaterThan(0);
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
});
