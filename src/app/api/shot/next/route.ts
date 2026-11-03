import { fail, json, readJson } from "@/lib/server/http";
import { ROUND_LIMIT_MS } from "@/games/shot-chart/engine/scoring";
import { issueShotToken, readShotToken, servedRound } from "@/games/shot-chart/server/run";
import { ROUNDS_PER_DAY } from "@/games/shot-chart/types";

export async function POST(req: Request) {
  const body = await readJson(req);
  const t = readShotToken(body?.token);
  if (!t) return fail("This game session has expired. Reload to pick up today's charts.");
  if (t.at != null || t.res.length !== t.i + 1 || t.i + 1 >= ROUNDS_PER_DAY) return fail("Make your guess first");
  const n = { ...t, i: t.i + 1, at: Date.now() };
  return json({ limitMs: ROUND_LIMIT_MS, round: servedRound(n, n.i), token: issueShotToken(n) });
}
