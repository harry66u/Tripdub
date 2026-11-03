import { fail, json, readJson } from "@/lib/server/http";
import { servePrompt } from "@/games/deep-cut/server/data";
import { issueDeepCutToken, promptAt, readDeepCutToken } from "@/games/deep-cut/server/run";
import { PROMPTS_PER_DAY, TIME_LIMIT_MS } from "@/games/deep-cut/types";

/** Serve the next prompt; its clock starts now. */
export async function POST(req: Request) {
  const body = await readJson(req);
  const t = readDeepCutToken(body?.token);
  if (!t) return fail("This game session has expired. Reload to pick up today's prompts.");
  if (t.at != null || t.res.length !== t.i + 1 || t.i + 1 >= PROMPTS_PER_DAY) return fail("Answer the current prompt first");
  const next = { ...t, i: t.i + 1, at: Date.now() };
  return json({
    index: next.i,
    total: PROMPTS_PER_DAY,
    limitMs: TIME_LIMIT_MS,
    prompt: servePrompt(promptAt(next, next.i)),
    token: issueDeepCutToken(next),
  });
}
