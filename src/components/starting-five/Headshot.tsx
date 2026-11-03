"use client";

import { useState } from "react";
import type { SFPlayer } from "@/games/starting-five/types";

export function headshotUrl(nbaId: number, size: "lg" | "sm"): string {
  const dims = size === "lg" ? "1040x760" : "260x190";
  return `https://cdn.nba.com/headshots/nba/latest/${dims}/${nbaId}.png`;
}

function initials(name: string): string {
  const parts = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

type Props = {
  player: Pick<SFPlayer, "name" | "nbaId">;
  size: "lg" | "sm";
  className?: string;
};

/**
 * Official NBA.com headshot. Large: a framed "court" photo for the player card.
 * Small: a round avatar. Falls back to varsity initials if the photo is unavailable.
 */
export function Headshot({ player, size, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const src = player.nbaId != null && !failed ? headshotUrl(player.nbaId, size) : null;

  if (size === "sm") {
    return (
      <span
        className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink bg-sky ${className}`}
        aria-hidden
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full scale-[1.45] object-cover object-[50%_18%] translate-y-[14%]"
          />
        ) : (
          <span className="varsity text-sm">{initials(player.name)}</span>
        )}
      </span>
    );
  }

  return (
    <div
      className={`relative h-44 overflow-hidden rounded-[20px] border-[2.5px] border-ink bg-sky ${className}`}
      aria-hidden={!src}
    >
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
          src={src}
          alt={player.name}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
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
