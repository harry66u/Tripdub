import { fail, json, readJson } from "@/lib/server/http";
import { claimOnce, recordDailyResult, recordTriviaAnswer } from "@/lib/server/db";
import { MIN_ANSWERS_FOR_PCT, pointsFor, TIME_LIMIT_MS } from "@/games/trivia/engine/scoring";
import { shareTrivia } from "@/games/trivia/engine/share";
import { rankFor } from "@/games/starting-five/server/finish";
import { claimKey, issueTriviaToken, LATENCY_ALLOWANCE_MS, questionAt, readTriviaToken } from "@/games/trivia/server/run";
import { QUESTIONS_PER_DAY } from "@/games/trivia/types";
import { puzzleNumber } from "@/lib/day";

const LATE_GRACE_MS = 1500;

export async function POST(req: Request) {
  const body = await readJson(req);
  const t = readTriviaToken(body?.token);
  if (!t) return fail("This game session has expired. Reload to pick up today's questions.");
  if (t.at == null || t.res.length !== t.i) return fail("That question was already answered");
  const choice = Number.isInteger(body?.choice) && (body!.choice as number) >= 0 && (body!.choice as number) < 4 ? (body!.choice as number) : null;

  // One answer per served question: a replayed token can repeat its answer, never change it.
  let ms = Math.max(0, Date.now() - t.at - LATENCY_ALLOWANCE_MS);
  const claim = await claimOnce(claimKey(body!.token as string), JSON.stringify({ c: choice, ms }));
  if (claim && !claim.fresh) {
    const prior = JSON.parse(claim.value) as { c: number | null; ms: number };
    if (prior.c !== choice) return fail("You already answered this question", 409);
    ms = prior.ms;
  }

  const { q, options, correctIndex } = questionAt(t, t.i);
  const timedOut = choice == null || ms > TIME_LIMIT_MS + LATE_GRACE_MS;
  const correct = !timedOut && choice === correctIndex;
  const before = !claim || claim.fresh ? await recordTriviaAnswer(q.id, correct) : null;
  const pctBefore = before && before.total >= MIN_ANSWERS_FOR_PCT ? before.correct / before.total : null;
  const points = pointsFor({ correct, ms, pct: pctBefore });
  const totalAfter = before ? before.total + 1 : null;
  const pctAfter = before && totalAfter! >= MIN_ANSWERS_FOR_PCT ? (before.correct + (correct ? 1 : 0)) / totalAfter! : null;

  const res = [...t.res, { c: choice, ms: Math.min(ms, TIME_LIMIT_MS), pts: points.total, ok: correct }];
  const nextToken = { ...t, at: null, res };
  const score = res.reduce((s, r) => s + r.pts, 0);
  const reveal = {
    correct,
    timedOut,
    correctIndex,
    answer: options[correctIndex],
    points,
    ms: Math.min(ms, TIME_LIMIT_MS),
    pctCorrect: pctAfter,
    answeredBy: totalAfter,
    score,
    index: t.i,
    total: QUESTIONS_PER_DAY,
    token: issueTriviaToken(nextToken),
  };
  if (res.length < QUESTIONS_PER_DAY) return json(reveal);

  const results = res.map((r) => ({ correct: r.ok, ms: r.ms, pts: r.pts }));
  const totalMs = res.reduce((s, r) => s + r.ms, 0);
  const rank =
    t.mode === "daily"
      ? rankFor(
          await recordDailyResult({
            game: "trivia",
            date: t.date,
            device: t.device,
            score,
            tiebreak: -totalMs / 1000,
            detail: { answers: res.map((r) => r.c), correct: results.filter((r) => r.correct).length },
          }),
        )
      : { percentile: null, total: null };
  const n = t.mode === "daily" ? puzzleNumber(t.date) : null;
  return json({
    ...reveal,
    done: {
      score,
      results,
      percentile: rank.percentile,
      total: rank.total,
      share: shareTrivia({ puzzleNumber: n, results, score, percentile: rank.percentile }),
    },
  });
}
