import { nextResetAt, puzzleDate, puzzleNumber } from "@/lib/day";
import { fail, isDeviceId, json, readJson } from "@/lib/server/http";
import { replay } from "@/games/starting-five/engine/run";
import { lineupFromIds, mysteryClues } from "@/games/starting-five/server/finish";
import { playerById } from "@/games/starting-five/server/data";
import { getSFPuzzle } from "@/games/starting-five/server/puzzle";
import { issueRunToken } from "@/games/starting-five/server/run-token";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body || !isDeviceId(body.device)) return fail("Missing or invalid device id");
  const date = puzzleDate();
  const puzzle = getSFPuzzle(date);
  const view = replay(puzzle.spins, []);
  return json({
    date,
    puzzleNumber: puzzleNumber(date),
    theme: puzzle.theme,
    clues: mysteryClues(lineupFromIds(puzzle.mystery)),
    token: issueRunToken({ v: 1, date, device: body.device, actions: [] }),
    view,
    current: playerById(view.currentId!),
    lineup: {},
    nextResetAt: nextResetAt().toISOString(),
  });
}
