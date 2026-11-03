import { POOL } from "@/games/starting-five/server/data";

export const dynamic = "force-static";

/** Names and tiers only, for the wheel's decoy segments. No stats, no schedule. */
export function GET() {
  const names = POOL.map((p) => ({ n: p.name, t: p.tier }));
  return new Response(JSON.stringify(names), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=86400, s-maxage=86400" },
  });
}
