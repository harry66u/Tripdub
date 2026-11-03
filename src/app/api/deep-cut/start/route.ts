import { randomUUID } from "node:crypto";
import { nextResetAt, puzzleDate, puzzleNumber } from "@/lib/day";
import { fail, isDeviceId, json, readJson } from "@/lib/server/http";
import { servePrompt } from "@/games/deep-cut/server/data";
import { isArchiveDay, issueDeepCutToken, LEAD_MS, MAX_TRIES, promptAt, type DCMode, type DCToken } from "@/games/deep-cut/server/run";
import { PROMPTS_PER_DAY, TIME_LIMIT_MS } from "@/games/deep-cut/types";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body || !isDeviceId(body.device)) return fail("Missing or invalid device id");
  const m = body.mode ?? "daily";
  if (m !== "daily" && m !== "unlimited" && m !== "archive") return fail("Unknown game mode");
  const mode = m as DCMode;
  const date = puzzleDate();
  if (mode === "archive" && !isArchiveDay(body.day, date)) return fail("That day isn't in the archive");
  const day = mode === "archive" ? (body.day as string) : date;
  const t: DCToken = { v: 1, mode, date, day, salt: mode === "unlimited" ? randomUUID() : "", device: body.device, rid: randomUUID(), i: 0, at: Date.now() + LEAD_MS, tries: 0, res: [] };
  return json({
    mode,
    date,
    day,
    puzzleNumber: mode === "unlimited" ? null : puzzleNumber(day),
    index: 0,
    total: PROMPTS_PER_DAY,
    limitMs: TIME_LIMIT_MS,
    leadMs: LEAD_MS,
    maxTries: MAX_TRIES,
    prompt: servePrompt(promptAt(t, 0)),
    token: issueDeepCutToken(t),
    nextResetAt: nextResetAt().toISOString(),
  });
}
