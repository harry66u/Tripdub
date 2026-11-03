import { randomUUID } from "node:crypto";
import { nextResetAt, puzzleDate, puzzleNumber } from "@/lib/day";
import { fail, isDeviceId, json, readJson } from "@/lib/server/http";
import { replay } from "@/games/starting-five/engine/run";
import { lineupFromIds, opponentClues, puzzleHash, runPuzzle, type Mode } from "@/games/starting-five/server/finish";
import { playerById } from "@/games/starting-five/server/data";
import { issueRunToken } from "@/games/starting-five/server/run-token";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body || !isDeviceId(body.device)) return fail("Missing or invalid device id");
  const mode: Mode | null = body.mode === undefined || body.mode === "daily" ? "daily" : body.mode === "unlimited" ? "unlimited" : null;
  if (!mode) return fail("Unknown game mode");
  const date = puzzleDate();
  const salt = mode === "unlimited" ? randomUUID() : "";
  const puzzle = runPuzzle({ mode, date, salt });
  const view = replay(puzzle.spins, []);
  const opponent = lineupFromIds(puzzle.mystery);
  return json({
    mode,
    date,
    puzzleNumber: mode === "daily" ? puzzleNumber(date) : null,
    theme: puzzle.theme,
    opponent,
    clues: opponentClues(opponent),
    token: issueRunToken({ v: 2, mode, date, salt, ph: puzzleHash(puzzle), device: body.device, actions: [] }),
    view,
    current: playerById(view.currentId!),
    lineup: {},
    nextResetAt: nextResetAt().toISOString(),
  });
}
