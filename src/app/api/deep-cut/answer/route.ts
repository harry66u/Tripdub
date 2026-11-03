import { fail, json, readJson } from "@/lib/server/http";
import { claimOnce, recordDailyResult } from "@/lib/server/db";
import { rankFor } from "@/games/starting-five/server/finish";
import { NAME_INDEX, isPlayer, playerName } from "@/games/deep-cut/server/data";
import { resolveExact } from "@/games/deep-cut/engine/match";
import { feetFor, pointsFor } from "@/games/deep-cut/engine/scoring";
import { shareDeepCut } from "@/games/deep-cut/engine/share";
import { claimKey, issueDeepCutToken, LATE_GRACE_MS, LATENCY_ALLOWANCE_MS, promptAt, rarestAnswers, readDeepCutToken } from "@/games/deep-cut/server/run";
import { PROMPTS_PER_DAY, TIME_LIMIT_MS } from "@/games/deep-cut/types";
import { puzzleNumber } from "@/lib/day";

export async function POST(req: Request) {
  const body = await readJson(req);
  const t = readDeepCutToken(body?.token);
  if (!t) return fail("This game session has expired. Reload to pick up today's prompts.");
  if (t.at == null || t.res.length !== t.i) return fail("That prompt was already answered");

  // Who did they name? A picked autocomplete id, or typed text that is exactly one player's name.
  const player = isPlayer(body!.pid)
    ? (body!.pid as string)
    : typeof body!.text === "string" && body!.text.length <= 80
      ? (resolveExact(NAME_INDEX, body!.text)?.i ?? null)
      : null;

  // One answer per served prompt: a replayed token can repeat its answer, never change it.
  let ms = Math.max(0, Date.now() - t.at - LATENCY_ALLOWANCE_MS);
  const claim = await claimOnce(claimKey(body!.token as string), JSON.stringify({ p: player, ms }));
  if (claim && !claim.fresh) {
    const prior = JSON.parse(claim.value) as { p: string | null; ms: number };
    if (prior.p !== player) return fail("You already answered this prompt", 409);
    ms = prior.ms;
  }

  // Validity comes only from the prebuilt answer list for this prompt.
  const prompt = promptAt(t, t.i);
  const timedOut = ms > TIME_LIMIT_MS + LATE_GRACE_MS;
  const tier = !timedOut && player ? (prompt.answers[player] ?? null) : null;
  const points = pointsFor(tier);
  const res = [...t.res, { p: player, t: tier, pts: points, ms: Math.min(ms, TIME_LIMIT_MS) }];
  const score = res.reduce((s, r) => s + r.pts, 0);
  const reveal = {
    valid: !!tier,
    timedOut,
    tier,
    points,
    feet: feetFor(points),
    name: player ? playerName(player) : null,
    count: Object.keys(prompt.answers).length,
    score,
    range: feetFor(score),
    index: t.i,
    total: PROMPTS_PER_DAY,
    token: issueDeepCutToken({ ...t, at: null, res }),
  };
  if (res.length < PROMPTS_PER_DAY) return json(reveal);

  const results = res.map((r, i) => {
    const p = promptAt(t, i);
    return {
      id: p.id,
      text: p.text,
      answer: r.p ? playerName(r.p) : null,
      tier: r.t,
      pts: r.pts,
      count: Object.keys(p.answers).length,
      rare: rarestAnswers(p, r.p),
    };
  });
  const totalMs = res.reduce((s, r) => s + r.ms, 0);
  const rank =
    t.mode === "daily"
      ? rankFor(
          await recordDailyResult({
            game: "deep-cut",
            date: t.date,
            device: t.device,
            score,
            tiebreak: -totalMs / 1000,
            detail: { answers: res.map((r) => r.p), tiers: res.map((r) => r.t) },
          }),
        )
      : { percentile: null, total: null };
  return json({
    ...reveal,
    done: {
      score,
      feet: feetFor(score),
      results,
      percentile: rank.percentile,
      total: rank.total,
      share: shareDeepCut({
        puzzleNumber: t.mode === "unlimited" ? null : puzzleNumber(t.day),
        archive: t.mode === "archive",
        tiers: res.map((r) => r.t),
        score,
        percentile: rank.percentile,
      }),
    },
  });
}
