import { randomUUID } from "node:crypto";
import { puzzleDate, puzzleNumber } from "@/lib/day";
import { fail, isDeviceId, json, readJson } from "@/lib/server/http";
import { ROUND_LIMIT_MS } from "@/games/shot-chart/engine/scoring";
import { issueShotToken, servedRound, type ShotToken } from "@/games/shot-chart/server/run";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body || !isDeviceId(body.device)) return fail("Missing or invalid device id");
  const mode = body.mode === undefined || body.mode === "daily" ? "daily" : body.mode === "unlimited" ? "unlimited" : null;
  if (!mode) return fail("Unknown game mode");
  const date = puzzleDate();
  const t: ShotToken = { v: 1, mode, date, salt: mode === "unlimited" ? randomUUID() : "", device: body.device, rid: randomUUID(), i: 0, at: Date.now(), res: [] };
  return json({ mode, date, puzzleNumber: mode === "daily" ? puzzleNumber(date) : null, limitMs: ROUND_LIMIT_MS, round: servedRound(t, 0), token: issueShotToken(t) });
}
