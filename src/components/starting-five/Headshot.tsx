"use client";

import { useEffect, useMemo, useState } from "react";
import { headshotCandidates, latestHeadshot, type PhotoSubject } from "./headshot-urls";

export { headshotCandidates };

/** The player's latest NBA.com headshot (no season). */
export function headshotUrl(nbaId: number, size: "lg" | "sm"): string {
  return latestHeadshot(nbaId, size);
}

function initials(name: string): string {
  const parts = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

type Props = {
  player: PhotoSubject & { name: string };
  size: "lg" | "sm";
  className?: string;
};

/**
 * Official NBA.com headshot, from that season when NBA.com has one, else the latest. Large: a
 * framed "court" photo for cards. Small: a round avatar. Falls back to varsity initials.
 */
export function Headshot({ player, size, className = "" }: Props) {
  const urls = useMemo(
    () => headshotCandidates(player, size),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player.nbaId, player.season, player.team?.name, size],
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [urls]);
  const src = urls[attempt] ?? null;
  const next = () => setAttempt((a) => a + 1);

  if (size === "sm") {
    return (
      <span
        className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink bg-sky ${className}`}
        aria-hidden
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={next}
            className="absolute inset-0 h-full w-full scale-[1.45] object-cover object-[50%_18%] translate-y-[14%]"
          />
        ) : (
          <span className="varsity text-sm">{initials(player.name)}</span>
        )}
      </span>
    );
  }

  return (
    <div className={`relative h-44 overflow-hidden rounded-[20px] border-[2.5px] border-ink bg-sky ${className}`} aria-hidden={!src}>
      {/* painted half-court behind the player */}
      <svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="#fff" strokeWidth="3" opacity="0.75">
          <path d="M40 180 V120 A160 160 0 0 1 360 120 V180" />
          <rect x="140" y="70" width="120" height="110" />
          <circle cx="200" cy="70" r="40" />
        </g>
      </svg>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={player.name}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={next}
          className="absolute inset-x-0 bottom-0 mx-auto h-full w-auto max-w-none object-contain object-bottom"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className="varsity grid h-24 w-24 place-items-center rounded-full border-[2.5px] border-ink bg-white text-4xl shadow-[var(--shadow-pop-sm)]">
            {initials(player.name)}
          </span>
        </div>
      )}
    </div>
  );
}
