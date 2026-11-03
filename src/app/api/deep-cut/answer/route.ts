import { fail, json, readJson } from "@/lib/server/http";
import { claimOnce, recordDailyResult } from "@/lib/server/db";
import { rankFor } from "@/games/starting-five/server/finish";
import { NAME_INDEX, playerName } from "@/games/deep-cut/server/data";
import { normName, resolveGuess } from "@/games/deep-cut/engine/match";
import { feetFor, pointsFor } from "@/games/deep-cut/engine/scoring";
import { shareDeepCut } from "@/games/deep-cut/engine/share";
import {
  claimKey,
  issueDeepCutToken,
  LATE_GRACE_MS,
  LATENCY_ALLOWANCE_MS,
  MAX_TRIES,
  promptAt,
  rarestAnswers,
  readDeepCutToken,
} from "@/games/deep-cut/server/run";
import { PROMPTS_PER_DAY, TIME_LIMIT_MS } from "@/games/deep-cut/types";
import { puzzleNumber } from "@/lib/day";

/**
 * One shot at the current prompt: a typed name, or a pass. A name that isn't a valid answer is
 * rejected and the prompt stays open (the shot clock keeps running); a valid one locks in its tier.
 * Each token takes exactly one shot, so a rejected guess can't be swapped after the fact.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const t = readDeepCutToken(body?.token);
  if (!t) return fail("This game session has expired. Reload to pick up today's prompts.");
  if (t.at == null || t.res.length !== t.i) return fail("That prompt was already answered");
  // The client sends `buzzer` when its shot clock hits zero; that ends the prompt like a pass.
  const buzzer = body!.buzzer === true;
  const pass = body!.pass === true || buzzer;
  const text = typeof body!.text === "string" ? body!.text.slice(0, 80) : "";
  if (!pass && !normName(text)) return fail("Type a player's name");

  let ms = Math.max(0, Date.now() - t.at - LATENCY_ALLOWANCE_MS);
  const shot = { q: normName(text), pass };
  const claim = await claimOnce(claimKey(body!.token as string), JSON.stringify({ ...shot, ms }));
  if (claim && !claim.fresh) {
    const prior = JSON.parse(claim.value) as { q: string; pass: boolean; ms: number };
    if (prior.q !== shot.q || prior.pass !== shot.pass) return fail("That shot was already taken", 409);
    ms = prior.ms;
  }

  const prompt = promptAt(t, t.i);
  const timedOut = buzzer || ms > TIME_LIMIT_MS + LATE_GRACE_MS;
  const guess = !pass && !timedOut ? resolveGuess(NAME_INDEX, text) : null;
  const player = guess?.status === "found" ? guess.entry.i : null;
  const tier = player ? (prompt.answers[player] ?? null) : null;

  // Not a valid answer: bounce it, keep the prompt open. We don't say whether it was a real player.
  if (!pass && !timedOut && !tier && t.tries + 1 < MAX_TRIES) {
    const tries = t.tries + 1;
    return json({
      status: "rejected",
      reason: guess?.status === "ambiguous" ? "ambiguous" : "nope",
      tries,
      triesLeft: MAX_TRIES - tries,
      leftMs: Math.max(0, TIME_LIMIT_MS - ms),
      token: issueDeepCutToken({ ...t, tries }),
    });
  }

  const outOfTries = !pass && !timedOut && !tier;
  const points = pointsFor(tier);
  const res = [...t.res, { p: tier ? player : null, t: tier, pts: points, ms: Math.min(ms, TIME_LIMIT_MS) }];
  const score = res.reduce((s, r) => s + r.pts, 0);
  const reveal = {
    status: "scored" as const,
    valid: !!tier,
    timedOut,
    passed: pass && !timedOut,
    outOfTries,
    tier,
    points,
    feet: feetFor(points),
    name: tier && player ? playerName(player) : null,
    corrected: !!(tier && guess?.status === "found" && guess.corrected),
    count: Object.keys(prompt.answers).length,
    score,
    range: feetFor(score),
    index: t.i,
    total: PROMPTS_PER_DAY,
    token: issueDeepCutToken({ ...t, at: null, tries: 0, res }),
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
