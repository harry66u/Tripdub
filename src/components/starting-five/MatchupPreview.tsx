"use client";

import { matchupEdge, type Edge } from "@/games/starting-five/engine/matchup";
import { SLOTS, type Lineup, type RatingKey, type SFPlayer, type Slot } from "@/games/starting-five/types";
import { Headshot } from "./Headshot";

const ROWS: [RatingKey, string][] = [
  ["sco", "Scoring"],
  ["spc", "Shooting"],
  ["ply", "Playmaking"],
  ["reb", "Rebounding"],
  ["per", "Perimeter D"],
  ["rim", "Rim protection"],
];

export function EdgeChip({ edge, compact }: { edge: Edge; compact?: boolean }) {
  const tone = edge.side === "you" ? "bg-mint" : edge.side === "them" ? "bg-coral text-white" : "bg-sky";
  const text = compact ? (edge.side === "you" ? "You" : edge.side === "them" ? "Them" : "Even") : edge.label;
  return <span className={`inline-block rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap ${tone}`}>{text}</span>;
}

/** Side-by-side ratings for one slot, like a 2K matchup screen. */
export function MatchupPreview({ slot, mine, theirs }: { slot: Slot; mine: SFPlayer; theirs: SFPlayer }) {
  const edge = matchupEdge(mine, theirs);
  return (
    <div className="pop rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold">
          Matchup at <span className="varsity">{slot}</span>
        </h3>
        <EdgeChip edge={edge} />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="flex min-w-0 flex-col items-center gap-1">
          <Headshot player={mine} size="sm" className="h-12 w-12" />
          <p className="text-sm font-bold leading-tight">
            <span className="varsity mr-1 text-xs text-coral-deep">{mine.season}</span>
            {mine.name}
          </p>
        </div>
        <span className="varsity text-sm text-ink-soft">vs</span>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <Headshot player={theirs} size="sm" className="h-12 w-12" />
          <p className="text-sm font-bold leading-tight">
            <span className="varsity mr-1 text-xs text-coral-deep">{theirs.season}</span>
            {theirs.name}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5">
        {ROWS.map(([k, label]) => {
          const a = mine.r[k];
          const b = theirs.r[k];
          return (
            <div key={k} className="grid grid-cols-[2rem_1fr_6.5rem_1fr_2rem] items-center gap-1.5 text-xs">
              <span className={`varsity tnum text-right text-sm ${a > b ? "text-ink" : "text-ink-soft"}`}>{a}</span>
              <span className="flex h-2.5 justify-end overflow-hidden rounded-full bg-wash">
                <span className={`h-full rounded-full ${a >= b ? "bg-coral" : "bg-sky-deep"}`} style={{ width: `${a}%` }} />
              </span>
              <span className="text-center font-semibold text-ink-soft">{label}</span>
              <span className="flex h-2.5 overflow-hidden rounded-full bg-wash">
                <span className={`h-full rounded-full ${b >= a ? "bg-ink" : "bg-sky-deep"}`} style={{ width: `${b}%` }} />
              </span>
              <span className={`varsity tnum text-sm ${b > a ? "text-ink" : "text-ink-soft"}`}>{b}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tip-off preview: the five matchups and who has the edge in each. */
export function TipoffPreview({ lineup, opponent, theme }: { lineup: Lineup; opponent: Lineup; theme: string }) {
  const edges = SLOTS.map((s) => matchupEdge(lineup[s], opponent[s]));
  const won = edges.filter((e) => e.side === "you").length;
  const lost = edges.filter((e) => e.side === "them").length;
  return (
    <div className="pop rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
      <h3 className="text-lg font-extrabold">Tip-off preview</h3>
      <p className="mt-1 text-sm text-ink-soft">
        You have the edge in {won} of 5 matchups{lost ? `, the ${theme} in ${lost}` : ""}.
      </p>
      <ul className="mt-3 grid gap-1.5">
        {SLOTS.map((s, i) => (
          <li key={s} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
            <span className="varsity">{s}</span>
            <span className="truncate font-semibold">{lineup[s].name}</span>
            <EdgeChip edge={edges[i]} compact />
            <span className="truncate text-right font-semibold text-ink-soft">{opponent[s].name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
