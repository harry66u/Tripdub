import { fail, json, readJson } from "@/lib/server/http";
import { recordDailyResult } from "@/lib/server/db";
import { RunError } from "@/games/starting-five/engine/run";
import { shareText } from "@/games/starting-five/engine/share";
import { finishRun } from "@/games/starting-five/server/finish";
import { readRunToken } from "@/games/starting-five/server/run-token";
import { SLOTS } from "@/games/starting-five/types";

export async function POST(req: Request) {
  const body = await readJson(req);
  const run = readRunToken(body?.token);
  if (!run) return fail("This game session has expired. Reload to pick up today's puzzle.");
  let result;
  try {
    result = finishRun(run);
  } catch (e) {
    if (e instanceof RunError) return fail(e.message);
    throw e;
  }
  const rank = await recordDailyResult({
    game: "starting-five",
    date: run.date,
    device: run.device,
    score: result.winProb * 100,
    tiebreak: result.meanMargin,
    detail: {
      lineup: Object.fromEntries(SLOTS.map((s) => [s, result.lineup[s].id])),
      score: [result.featured.home.score, result.featured.away.score],
      actions: run.actions,
    },
  });
  if (rank) {
    result.percentile = rank.percentile;
    result.total = rank.total;
    result.share = shareText({
      puzzleNumber: result.puzzleNumber,
      won: result.featured.home.score > result.featured.away.score,
      homeScore: result.featured.home.score,
      awayScore: result.featured.away.score,
      winProb: result.winProb,
      grades: result.grades,
      percentile: rank.percentile,
    });
  }
  return json(result);
}
