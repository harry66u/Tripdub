"use client";

import { useEffect, useState } from "react";
import type { WheelName } from "@/games/starting-five/api-types";
import { headshotCandidates } from "./headshot-urls";

export type Face = { n: string; t: WheelName["t"]; url: string | null };

const POOL_SIZE = 40;

/** Try that season's photo, then the latest (small, then large); resolve to whichever loads. */
function loadFace(n: WheelName): Promise<string | null> {
  const attempt = (url: string) =>
    new Promise<string | null>((resolve) => {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  const subject = { nbaId: n.i, season: n.s, team: n.tm ? { abbr: "", name: n.tm } : undefined };
  const urls = [...headshotCandidates(subject, "sm"), ...headshotCandidates({ nbaId: n.i }, "lg")];
  return urls.reduce<Promise<string | null>>((p, url) => p.then((ok) => ok ?? attempt(url)), Promise.resolve(null));
}

/**
 * A pool of player faces that have actually loaded, warmed up as soon as the page opens, so the
 * roulette always flashes real faces instead of empty frames. Until (or unless) photos load,
 * faces come back with url: null and the roulette shows initials.
 */
export function useFacePool(names: WheelName[] | null): Face[] {
  const [loaded, setLoaded] = useState<Face[]>([]);
  useEffect(() => {
    if (!names?.length) return;
    let cancelled = false;
    // Recognizable faces first: legends and All-Stars, then a mix.
    const ranked = names
      .filter((n) => n.i != null)
      .map((n, i) => ({ n, w: (n.t === "legend" ? 3 : n.t === "allstar" ? 2 : 1) + ((i * 7919) % 100) / 100 }))
      .sort((a, b) => b.w - a.w)
      .slice(0, POOL_SIZE)
      .map((x) => x.n);
    for (const n of ranked) {
      void loadFace(n).then((url) => {
        if (!cancelled && url) setLoaded((prev) => (prev.some((f) => f.n === n.n) ? prev : [...prev, { n: n.n, t: n.t, url }]));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [names]);

  if (loaded.length >= 8) return loaded;
  // Not enough photos yet (or the photo CDN is unreachable): fall back to initials.
  return (names ?? []).slice(0, POOL_SIZE).map((n) => ({ n: n.n, t: n.t, url: loaded.find((f) => f.n === n.n)?.url ?? null }));
}
