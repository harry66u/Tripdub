import { randomUUID } from "node:crypto";
import { nextResetAt, puzzleDate, puzzleNumber } from "@/lib/day";
import { fail, isDeviceId, json, readJson } from "@/lib/server/http";
import { TIME_LIMIT_MS } from "@/games/trivia/engine/scoring";
import { issueTriviaToken, questionAt, type TriviaToken } from "@/games/trivia/server/run";
import { QUESTIONS_PER_DAY } from "@/games/trivia/types";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body || !isDeviceId(body.device)) return fail("Missing or invalid device id");
  const mode = body.mode === undefined || body.mode === "daily" ? "daily" : body.mode === "unlimited" ? "unlimited" : null;
  if (!mode) return fail("Unknown game mode");
  const date = puzzleDate();
  const t: TriviaToken = { v: 1, mode, date, salt: mode === "unlimited" ? randomUUID() : "", device: body.device, rid: randomUUID(), i: 0, at: Date.now(), res: [] };
  return json({
    mode,
    date,
    puzzleNumber: mode === "daily" ? puzzleNumber(date) : null,
    index: 0,
    total: QUESTIONS_PER_DAY,
    limitMs: TIME_LIMIT_MS,
    question: questionAt(t, 0).served,
    token: issueTriviaToken(t),
    nextResetAt: nextResetAt().toISOString(),
  });
}
