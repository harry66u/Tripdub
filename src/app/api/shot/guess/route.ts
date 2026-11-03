import { fail, json, readJson } from "@/lib/server/http";
import { claimOnce, recordDailyResult } from "@/lib/server/db";
import { puzzleNumber } from "@/lib/day";
import { pointsForGuess, ROUND_LIMIT_MS } from "@/games/shot-chart/engine/scoring";
import { shareShot } from "@/games/shot-chart/engine/share";
import { rankFor } from "@/games/starting-five/server/finish";
import { claimKey, issueShotToken, LATENCY_ALLOWANCE_MS, readShotToken, revealOf, roundAt } from "@/games/shot-chart/server/run";
import { ROUNDS_PER_DAY } from "@/games/shot-chart/types";

export async function POST(req: Request) {
  const body = await readJson(req);
  const t = readShotToken(body?.token);
  if (!t) return fail("This game session has expired. Reload to pick up today's charts.");
  if (t.at == null || t.res.length !== t.i) return fail("You already guessed this one");
  const choice = Number.isInteger(body?.choice) && (body!.choice as number) >= 0 && (body!.choice as number) < 4 ? (body!.choice as number) : null;
  let ms = Math.max(0, Date.now() - t.at - LATENCY_ALLOWANCE_MS);
  const claim = await claimOnce(claimKey(body!.token as string), JSON.stringify({ c: choice, ms }));
  if (claim && !claim.fresh) {
    const prior = JSON.parse(claim.value) as { c: number | null; ms: number };
    if (prior.c !== choice) return fail("You already guessed this one", 409);
    ms = prior.ms;
  }
  const { answer, correctIndex } = roundAt(t, t.i);
  const timedOut = choice == null || ms > ROUND_LIMIT_MS + 1500;
  const correct = !timedOut && choice === correctIndex;
  const points = pointsForGuess(correct, ms);
  const res = [...t.res, { c: choice, ms: Math.min(ms, ROUND_LIMIT_MS), pts: points.total, ok: correct }];
  const score = res.reduce((s, r) => s + r.pts, 0);
  const reveal = {
    correct,
    timedOut,
    correctIndex,
    answer: revealOf(answer),
    points,
    ms: Math.min(ms, ROUND_LIMIT_MS),
    score,
    index: t.i,
    total: ROUNDS_PER_DAY,
    token: issueShotToken({ ...t, at: null, res }),
  };
  if (res.length < ROUNDS_PER_DAY) return json(reveal);
  const results = res.map((r) => r.ok);
  const rank =
    t.mode === "daily"
      ? rankFor(
          await recordDailyResult({
            game: "shot-chart",
            date: t.date,
            device: t.device,
            score,
            tiebreak: -res.reduce((s, r) => s + r.ms, 0) / 1000,
            detail: { guesses: res.map((r) => r.c), correct: results.filter(Boolean).length },
          }),
        )
      : { percentile: null, total: null };
  return json({
    ...reveal,
    done: {
      score,
      results,
      percentile: rank.percentile,
      total: rank.total,
      share: shareShot({ puzzleNumber: t.mode === "daily" ? puzzleNumber(t.date) : null, results, score, percentile: rank.percentile }),
    },
  });
}
