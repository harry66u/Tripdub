import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type GameId = "starting-five" | "trivia" | "shot-chart";

let client: SupabaseClient | null | undefined;

function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  } catch {
    client = null;
  }
  return client;
}

/**
 * Call a secret-checked RPC. Returns null when the database isn't configured, is unreachable,
 * or errors: games must keep working without it.
 */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const secret = process.env.DB_SERVER_SECRET;
  if (!secret) return null;
  try {
    const c = db();
    if (!c) return null;
    const { data, error } = await c.rpc(fn, { p_secret: secret, ...args }).abortSignal(AbortSignal.timeout(3000));
    if (error || data == null) {
      console.error(`${fn} failed`, error?.message);
      return null;
    }
    return data as T;
  } catch (e) {
    console.error(`${fn} threw`, (e as Error).message);
    return null;
  }
}

/** Store a validated daily result (first finish per device wins) and rank it against today's. */
export async function recordDailyResult(input: {
  game: GameId;
  date: string;
  device: string;
  score: number;
  tiebreak: number;
  detail: Record<string, unknown>;
}): Promise<{ percentile: number; total: number } | null> {
  const data = await rpc<{ percentile: number; total: number }>("record_daily_result", {
    p_game: input.game,
    p_date: input.date,
    p_device: input.device,
    p_score: input.score,
    p_tiebreak: input.tiebreak,
    p_detail: input.detail,
  });
  return data ? { percentile: Number(data.percentile), total: Number(data.total) } : null;
}

/** Count one trivia answer. Returns the question's stats from before this answer. */
export async function recordTriviaAnswer(questionId: string, correct: boolean): Promise<{ total: number; correct: number } | null> {
  const data = await rpc<{ total: number; correct: number }>("record_trivia_answer", { p_question: questionId, p_correct: correct });
  return data ? { total: Number(data.total), correct: Number(data.correct) } : null;
}

/**
 * Claim a one-time key (e.g. "this exact game step"). Returns the value stored for it, yours if you
 * were first, plus whether this call made the claim. null = database unavailable.
 */
export async function claimOnce(key: string, value: string): Promise<{ value: string; fresh: boolean } | null> {
  const data = await rpc<{ value: string; fresh: boolean }>("claim_once", { p_key: key, p_value: value });
  return data ? { value: String(data.value), fresh: Boolean(data.fresh) } : null;
}
