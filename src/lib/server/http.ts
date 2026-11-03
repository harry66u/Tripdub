import "server-only";
import { createHash } from "node:crypto";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * HMAC key for run tokens. RUN_TOKEN_SECRET if set; otherwise derived from DB_SERVER_SECRET,
 * so a deployment only needs one secret.
 */
export function runSecret(): string {
  const s = process.env.RUN_TOKEN_SECRET;
  if (s && s.length >= 16) return s;
  const db = process.env.DB_SERVER_SECRET;
  if (db && db.length >= 16) return createHash("sha256").update(`tripdub-run-token:${db}`).digest("hex");
  if (process.env.NODE_ENV === "production") throw new Error("Set DB_SERVER_SECRET (or RUN_TOKEN_SECRET)");
  return "dev-only-run-token-secret-change-me";
}

export const isDeviceId = (d: unknown): d is string => typeof d === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(d);
