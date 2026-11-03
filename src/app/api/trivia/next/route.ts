import { fail, json, readJson } from "@/lib/server/http";
import { TIME_LIMIT_MS } from "@/games/trivia/engine/scoring";
import { issueTriviaToken, questionAt, readTriviaToken } from "@/games/trivia/server/run";
import { QUESTIONS_PER_DAY } from "@/games/trivia/types";

/** Serve the next question; its clock starts now. */
export async function POST(req: Request) {
  const body = await readJson(req);
  const t = readTriviaToken(body?.token);
  if (!t) return fail("This game session has expired. Reload to pick up today's questions.");
  if (t.at != null || t.res.length !== t.i + 1 || t.i + 1 >= QUESTIONS_PER_DAY) return fail("Answer the current question first");
  const next = { ...t, i: t.i + 1, at: Date.now() };
  return json({
    index: next.i,
    total: QUESTIONS_PER_DAY,
    limitMs: TIME_LIMIT_MS,
    question: questionAt(next, next.i).served,
    token: issueTriviaToken(next),
  });
}
