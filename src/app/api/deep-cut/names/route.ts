import { NAMES } from "@/games/deep-cut/server/data";

export const dynamic = "force-static";

/** Every NBA player for autocomplete, most famous first: names, career years and aliases only. */
export async function GET() {
  const list = NAMES.map(({ i, n, y, a }) => (a ? { i, n, y, a } : { i, n, y }));
  return new Response(JSON.stringify(list), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
