"use client";

import { Star } from "@/components/brand/Ball";
import { formatHeight, formatLine, formatSeason } from "@/games/starting-five/engine/format";
import type { RatingKey, SFPlayer } from "@/games/starting-five/types";
import { Headshot } from "./Headshot";
import { Jersey, TeamLogo } from "./TeamArt";

export const RATING_LABELS: Record<RatingKey, string> = {
  sco: "Scoring",
  ply: "Playmaking",
  reb: "Rebounding",
  per: "Perimeter D",
  rim: "Rim protection",
  spc: "Shooting",
};
const RATING_ORDER: RatingKey[] = ["sco", "spc", "ply", "reb", "per", "rim"];

export const TIER_STYLE: Record<SFPlayer["tier"], { label: string; band: string; text: string }> = {
  legend: { label: "Legend", band: "bg-butter", text: "text-ink" },
  allstar: { label: "All-Star", band: "bg-coral", text: "text-white" },
  starter: { label: "Starter", band: "bg-sky", text: "text-ink" },
  role: { label: "Role player", band: "bg-sky-soft", text: "text-ink" },
};

/** Honors from that season (plus the Hall of Fame). */
export function accolades(p: SFPlayer): string[] {
  const out: string[] = [];
  if (p.acc.mvp) out.push("MVP");
  if (p.acc.dpoy) out.push("DPOY");
  if (p.acc.allNba) out.push(`All-NBA ${p.acc.allNba}`);
  if (p.acc.allStar) out.push("All-Star");
  if (p.acc.allDef && !p.acc.dpoy) out.push(`All-Defense ${p.acc.allDef}`);
  if (p.acc.hof) out.push("Hall of Fame");
  return out.slice(0, 4);
}

export function RatingBar({ label, value }: { label: string; value: number }) {
  const elite = value >= 85;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-ink-soft">{label}</span>
        <span className="varsity tnum text-sm">{value}</span>
      </div>
      <span className="relative h-2.5 overflow-hidden rounded-full border-2 border-ink bg-wash">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${elite ? "bg-coral" : "bg-sky-deep"}`}
          style={{ width: `${Math.max(4, value)}%` }}
        />
      </span>
    </div>
  );
}

type Props = {
  player: SFPlayer;
  className?: string;
  /** Controls under the card, e.g. the re-spin button */
  footer?: React.ReactNode;
  onPointerDown?: (e: React.PointerEvent) => void;
};

/** The reveal card: official headshot, real per-game line over his prime, and Tripdub ratings. */
export function PlayerCard({ player, className = "", footer, onPointerDown }: Props) {
  const tier = TIER_STYLE[player.tier];
  const line = formatLine(player.line).filter((s) => s.label !== "3PA" && s.label !== "TS%");
  const acc = accolades(player);
  return (
    <article
      className={`pop relative overflow-hidden rounded-[var(--radius-card)] bg-white ${className}`}
      onPointerDown={onPointerDown}
      aria-label={`${player.name}, ${player.pos}`}
    >
      <div
        data-grip
        className={`flex touch-none items-center justify-between gap-3 border-b-[2.5px] border-ink px-5 py-2 select-none ${tier.band} ${tier.text}`}
      >
        <span className="flex items-center gap-1.5 text-sm font-bold">
          {player.tier === "legend" && (
            <svg viewBox="-10 -10 20 20" className="h-4 w-4" aria-hidden>
              <Star cx={0} cy={0} r={8} />
            </svg>
          )}
          {tier.label}
        </span>
        <span className="text-sm font-semibold">{formatSeason(player.season)} season</span>
      </div>
      <div className="px-4 pt-4 pb-4 sm:px-5">
        <div data-grip className="relative select-none">
          <Headshot player={player} size="lg" />
          <span className="varsity absolute top-2.5 right-2.5 rounded-xl border-2 border-ink bg-white px-2 py-0.5 text-lg shadow-[var(--shadow-pop-sm)]">
            {player.pos}
          </span>
          <span className="absolute top-2.5 left-2.5 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-white p-1 empty:hidden">
            <TeamLogo team={player.team} className="h-full w-full" />
          </span>
          <Jersey team={player.team} className="absolute bottom-2 left-2.5 h-14 w-12 drop-shadow-[2px_3px_0_var(--color-ink)]" />
        </div>
        <h3 className="mt-3 text-[1.75rem] leading-[1.05] font-extrabold tracking-tight text-balance">
          <span className="varsity mr-2 text-[1.35rem] text-coral-deep">{player.season}</span>
          {player.name}
        </h3>
        <p className="mt-0.5 text-sm font-semibold text-ink-soft">{player.team.name}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className="rounded-full bg-wash px-2 py-0.5 text-ink-soft">{formatHeight(player.heightIn)}</span>
          {acc.map((a) => (
            <span key={a} className="rounded-full border-[1.5px] border-ink/70 px-2 py-0.5">
              {a}
            </span>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-7 gap-1 rounded-2xl border-2 border-ink bg-wash px-2 py-2 text-center">
          {line.map((s) => (
            <div key={s.label}>
              <dt className="text-[11px] font-semibold text-ink-soft">{s.label}</dt>
              <dd className="varsity tnum text-[15px] leading-tight">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {RATING_ORDER.map((k) => (
            <RatingBar key={k} label={RATING_LABELS[k]} value={player.r[k]} />
          ))}
        </div>
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </article>
  );
}
