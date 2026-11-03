import "server-only";

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

export function runSecret(): string {
  const s = process.env.RUN_TOKEN_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("RUN_TOKEN_SECRET is not set");
  return "dev-only-run-token-secret-change-me";
}

export const isDeviceId = (d: unknown): d is string => typeof d === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(d);
