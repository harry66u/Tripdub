"use client";

import { useState } from "react";
import { teamColors, teamLogoUrl } from "@/games/starting-five/teams";
import type { SFPlayer } from "@/games/starting-five/types";

/** An original tank-top jersey in the team's colors, with the team abbreviation on the front. */
export function Jersey({ team, className = "" }: { team: SFPlayer["team"]; className?: string }) {
  const c = teamColors(team.name);
  return (
    <svg viewBox="0 0 64 72" className={className} role="img" aria-label={`${team.name} jersey`}>
      <path
        d="M20 3 Q32 13 44 3 L52 6 Q50 18 58 24 L58 69 Q32 72 6 69 L6 24 Q14 18 12 6 Z"
        fill={c.jersey}
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M21 5 Q32 15 43 5" fill="none" stroke={c.trim} strokeWidth="3" />
      <path d="M13 8 Q12 19 7 24 M51 8 Q52 19 57 24" fill="none" stroke={c.trim} strokeWidth="3" />
      <text
        x="32"
        y="47"
        textAnchor="middle"
        fontSize={team.abbr.length > 3 ? 14 : 17}
        fill={c.text}
        stroke={c.trim}
        strokeWidth="0.8"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {team.abbr}
      </text>
    </svg>
  );
}

/** The franchise logo when the team's name matches today's franchise; nothing otherwise. */
export function TeamLogo({ team, className = "" }: { team: SFPlayer["team"]; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = teamLogoUrl(team.name);
  if (!url || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={team.name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}
