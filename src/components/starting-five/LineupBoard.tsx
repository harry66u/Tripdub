"use client";

import { motion } from "motion/react";
import type { Clue } from "@/games/starting-five/engine/archetype";
import type { GameResult, PlayerBox } from "@/games/starting-five/engine/sim";
import { SLOTS, type Lineup, type SFPlayer, type Slot } from "@/games/starting-five/types";
import { Headshot } from "./Headshot";
import { TeamLogo } from "./TeamArt";

type Props = {
  opponent: Lineup;
  clues: Record<Slot, Clue>;
  lineup: Partial<Record<Slot, SFPlayer>>;
  /** The revealed player waiting for a slot */
  pending: SFPlayer | null;
  preview: Slot | null;
  busy: boolean;
  dragOver: Slot | null;
  onPreview: (s: Slot) => void;
  onLock: (s: Slot) => void;
  /** After the game: box score lines on both sides */
  result?: GameResult;
};

function Lock() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-label="Locked">
      <rect x="2.5" y="7" width="11" height="7.5" rx="2" fill="var(--color-ink)" />
      <path d="M5 7V5.2a3 3 0 0 1 6 0V7" fill="none" stroke="var(--color-ink)" strokeWidth="2" />
    </svg>
  );
}

function BoxLine({ b, dark }: { b: PlayerBox; dark?: boolean }) {
  return (
    <span className={`tnum text-xs font-semibold ${dark ? "text-sky" : "text-ink-soft"}`}>
      <span className={`varsity text-sm ${dark ? "text-white" : "text-ink"}`}>{b.pts}</span> pts, {b.reb} reb, {b.ast} ast
    </span>
  );
}

export function SlotBadge({ slot, active }: { slot: Slot; active?: boolean }) {
  return (
    <span
      className={`varsity grid h-11 w-11 shrink-0 place-items-center rounded-full border-[2.5px] border-ink text-[16px] shadow-[2px_3px_0_0_var(--color-ink)] transition-colors sm:h-12 sm:w-12 sm:text-[17px] ${
        active ? "bg-coral text-white" : "bg-sky text-ink"
      }`}
    >
      {slot}
    </span>
  );
}

/** Five rows: your slot against the opposing player in the same slot. */
export function LineupBoard({ opponent, clues, lineup, pending, preview, busy, dragOver, onPreview, onLock, result }: Props) {
  return (
    <ol className="grid gap-2.5" aria-label="Your lineup against tonight’s opponent">
      {SLOTS.map((slot) => {
        const mine = lineup[slot];
        const open = !mine && !!pending && !result;
        const previewing = open && preview === slot;
        const theirs = opponent[slot];
        return (
          <li
            key={slot}
            data-slot={open ? slot : undefined}
            className={`grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-2 rounded-[20px] border-[2.5px] border-ink bg-white p-2 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3 sm:p-2.5 ${
              dragOver === slot ? "bg-coral-soft" : ""
            } ${open && !previewing ? "slot-invite" : "shadow-[var(--shadow-pop-sm)]"}`}
          >
            <SlotBadge slot={slot} active={previewing || dragOver === slot} />

            <div className="min-w-0">
              {mine ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                  className="flex min-w-0 items-center gap-2"
                >
                  <Headshot player={mine} size="sm" className="hidden sm:grid" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-bold leading-tight">
                      <span className="min-w-0 break-words">
                        <span className="varsity mr-1 text-xs text-coral-deep">{mine.season}</span>
                        {mine.name}
                      </span>
                      {!result && <Lock />}
                    </p>
                    {result ? <BoxLine b={result.home.players[slot]} /> : <p className="truncate text-xs text-ink-soft">{mine.team.abbr}, {mine.pos}</p>}
                  </div>
                </motion.div>
              ) : previewing ? (
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <span className="truncate text-sm font-bold text-ink/60">{pending!.name}</span>
                  <button type="button" className="btn btn-coral px-3 py-1 text-sm" disabled={busy} onClick={() => onLock(slot)}>
                    Lock in at {slot}
                  </button>
                </div>
              ) : open ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPreview(slot)}
                  className="w-full rounded-xl border-2 border-dashed border-coral px-2 py-2 text-left text-sm font-semibold text-coral-deep hover:bg-coral-soft"
                >
                  Put {pending!.name.split(" ").slice(-1)[0]} here
                </button>
              ) : (
                <p className="px-1 text-sm font-medium text-ink-soft/80">Open</p>
              )}
            </div>

            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-ink px-2 py-1.5 text-white">
              <Headshot player={theirs} size="sm" className="border-white" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight break-words">
                  <span className="varsity mr-1 text-xs text-butter">{theirs.season}</span>
                  {theirs.name}
                </p>
                {result ? (
                  <BoxLine b={result.away.players[slot]} dark />
                ) : (
                  <p className="text-[11px] font-semibold leading-tight text-sky">
                    {theirs.team.abbr}, {clues[slot].archetype}
                  </p>
                )}
              </div>
              <TeamLogo team={theirs.team} className="hidden h-7 w-7 shrink-0 rounded-full bg-white p-0.5 sm:block" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
