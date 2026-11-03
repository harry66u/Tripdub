import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const claims = new Map<string, string>();
vi.mock("@/lib/server/db", () => ({
  recordDailyResult: vi.fn(async () => ({ percentile: 0.6, total: 30 })),
  recordTriviaAnswer: vi.fn(async () => ({ total: 40, correct: 10 })),
  claimOnce: vi.fn(async (key: string, value: string) => {
    const fresh = !claims.has(key);
    if (fresh) claims.set(key, value);
    return { value: claims.get(key)!, fresh };
  }),
}));

import { claimOnce, recordDailyResult, recordTriviaAnswer } from "@/lib/server/db";
import { POST as start } from "@/app/api/trivia/start/route";
import { POST as answer } from "@/app/api/trivia/answer/route";
import { POST as next } from "@/app/api/trivia/next/route";
import { questionById } from "@/games/trivia/server/data";
import { getTriviaDay } from "@/games/trivia/server/puzzle";
import { serveQuestion } from "@/games/trivia/engine/options";
import { puzzleDate } from "@/lib/day";
import { hashSeed } from "@/lib/rng";

process.env.RUN_TOKEN_SECRET = "test-run-secret-abcdefghijklmnop";
const DEVICE = "device-trivia-01";

const post = async (h: (r: Request) => Promise<Response>, body: unknown) => {
  const res = await h(new Request("http://t/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

/** The right option index for the question currently served (test-only peek at the bank). */
function rightChoice(qid: string, salt = "") {
  const q = questionById(qid)!;
  return serveQuestion(q, hashSeed("trivia-opt", puzzleDate(), salt, qid)).correctIndex;
}

let now = 1_800_000_000_000;
beforeEach(() => {
  claims.clear();
  vi.mocked(recordDailyResult).mockClear();
  vi.mocked(recordTriviaAnswer).mockClear();
  vi.mocked(claimOnce).mockClear();
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

describe("trivia API", () => {
  it("start serves the first question without revealing the answer", async () => {
    const s = await post(start, { device: DEVICE });
    expect(s.status).toBe(200);
    expect(s.body.index).toBe(0);
    expect(s.body.total).toBe(7);
    expect(s.body.question.id).toBe(getTriviaDay(puzzleDate()).questions[0]);
    expect(s.body.question.options).toHaveLength(4);
    expect(JSON.stringify(s.body)).not.toMatch(/correct/i);
  });

  it("scores a fast correct answer and reveals the right one after", async () => {
    const s = await post(start, { device: DEVICE });
    now += 1300; // 1.3s, minus the latency allowance
    const a = await post(answer, { token: s.body.token, choice: rightChoice(s.body.question.id) });
    expect(a.status).toBe(200);
    expect(a.body.correct).toBe(true);
    expect(a.body.correctIndex).toBe(rightChoice(s.body.question.id));
    expect(a.body.points.base).toBe(100);
    expect(a.body.points.speed).toBeGreaterThan(90);
    // 10 of 40 got it before: rarity bonus 75 * 0.75
    expect(a.body.points.rarity).toBe(56);
    expect(a.body.pctCorrect).toBeCloseTo(11 / 41, 5);
  });

  it("gives nothing for a wrong answer or a late one", async () => {
    const s = await post(start, { device: DEVICE });
    const right = rightChoice(s.body.question.id);
    now += 2000;
    const wrong = await post(answer, { token: s.body.token, choice: (right + 1) % 4 });
    expect(wrong.body.correct).toBe(false);
    expect(wrong.body.points.total).toBe(0);

    const s2 = await post(start, { device: DEVICE + "b" });
    now += 30_000;
    const late = await post(answer, { token: s2.body.token, choice: rightChoice(s2.body.question.id) });
    expect(late.body.correct).toBe(false);
    expect(late.body.timedOut).toBe(true);
  });

  it("won't let a replayed token change its answer, but repeats the same answer idempotently", async () => {
    const s = await post(start, { device: DEVICE });
    const right = rightChoice(s.body.question.id);
    now += 1000;
    const first = await post(answer, { token: s.body.token, choice: (right + 1) % 4 });
    const again = await post(answer, { token: s.body.token, choice: (right + 1) % 4 });
    expect(again.status).toBe(200);
    expect(again.body.points).toEqual(first.body.points);
    const cheat = await post(answer, { token: s.body.token, choice: right });
    expect(cheat.status).toBe(409);
    expect(recordTriviaAnswer).toHaveBeenCalledTimes(1);
  });

  it("serves the next question only after an answer, then finishes with a share", async () => {
    let s = await post(start, { device: DEVICE });
    expect((await post(next, { token: s.body.token })).status).toBe(400);
    let token = s.body.token as string;
    let qid = s.body.question.id as string;
    let done: { status: number; body: { done?: { score: number; share: string; percentile: number | null } } } | null = null;
    for (let i = 0; i < 7; i++) {
      now += 3000;
      const a = await post(answer, { token, choice: rightChoice(qid) });
      if (i === 6) {
        done = a;
        break;
      }
      const n = await post(next, { token: a.body.token });
      expect(n.body.index).toBe(i + 1);
      token = n.body.token;
      qid = n.body.question.id;
    }
    expect(done!.body.done!.score).toBeGreaterThan(700);
    expect(done!.body.done!.share).toContain("TRIPDUB · Daily Trivia #");
    expect(done!.body.done!.percentile).toBe(0.6);
    expect(recordDailyResult).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordDailyResult).mock.calls[0][0]).toMatchObject({ game: "trivia", device: DEVICE });
    s = s;
  });

  it("unlimited games use fresh questions and are not recorded", async () => {
    const a = await post(start, { device: DEVICE, mode: "unlimited" });
    const b = await post(start, { device: DEVICE, mode: "unlimited" });
    expect(a.body.mode).toBe("unlimited");
    expect(a.body.question.id === b.body.question.id && a.body.token === b.body.token).toBe(false);
    expect(recordDailyResult).not.toHaveBeenCalled();
  });
});
