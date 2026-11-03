import { fail, json, readJson } from "@/lib/server/http";
import { isAction, replay, RunError } from "@/games/starting-five/engine/run";
import { playerById } from "@/games/starting-five/server/data";
import { getSFPuzzle } from "@/games/starting-five/server/puzzle";
import { issueRunToken, readRunToken } from "@/games/starting-five/server/run-token";
import { SLOTS } from "@/games/starting-five/types";

export async function POST(req: Request) {
  const body = await readJson(req);
  const run = readRunToken(body?.token);
  if (!run) return fail("This game session has expired. Reload to pick up today's puzzle.");
  if (!isAction(body?.action)) return fail("Unknown action");
  const actions = [...run.actions, body.action];
  const puzzle = getSFPuzzle(run.date);
  try {
    const view = replay(puzzle.spins, actions);
    return json({
      token: issueRunToken({ ...run, actions }),
      view,
      current: view.currentId ? playerById(view.currentId) : null,
      lineup: Object.fromEntries(SLOTS.filter((s) => view.lineup[s]).map((s) => [s, playerById(view.lineup[s]!)])),
    });
  } catch (e) {
    if (e instanceof RunError) return fail(e.message);
    throw e;
  }
}
