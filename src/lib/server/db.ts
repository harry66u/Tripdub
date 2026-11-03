import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type GameId = "starting-five" | "trivia" | "shot-chart";

let client: SupabaseClient | null | undefined;

function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}

/**
 * Store a validated daily result (first finish per device wins) and return where it ranks
 * today. Returns null when the database isn't configured or can't be reached.
 */
export async function recordDailyResult(input: {
  game: GameId;
  date: string;
  device: string;
  score: number;
  tiebreak: number;
  detail: Record<string, unknown>;
}): Promise<{ percentile: number; total: number } | null> {
  const c = db();
  const secret = process.env.DB_SERVER_SECRET;
  if (!c || !secret) return null;
  const { data, error } = await c.rpc("record_daily_result", {
    p_secret: secret,
    p_game: input.game,
    p_date: input.date,
    p_device: input.device,
    p_score: input.score,
    p_tiebreak: input.tiebreak,
    p_detail: input.detail,
  });
  if (error || !data) {
    console.error("record_daily_result failed", error?.message);
    return null;
  }
  return { percentile: Number(data.percentile), total: Number(data.total) };
}
