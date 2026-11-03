import { POOL } from "@/games/starting-five/server/data";

export const dynamic = "force-static";

/** One face per player (name, tier, NBA.com id) for the roulette. No stats, no schedule. */
export function GET() {
  const seen = new Set<string>();
  const names = [];
  for (const p of POOL) {
    if (seen.has(p.pid)) continue;
    seen.add(p.pid);
    names.push({ n: p.name, t: p.tier, i: p.nbaId, s: p.season, tm: p.team.name });
  }
  return new Response(JSON.stringify(names), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=86400, s-maxage=86400" },
  });
}
