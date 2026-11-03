"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Clue } from "@/games/starting-five/engine/archetype";
import { formatPrime } from "@/games/starting-five/engine/format";
import type { GameResult, PlayerBox } from "@/games/starting-five/engine/sim";
import { SLOTS, type Lineup, type SFPlayer, type Slot } from "@/games/starting-five/types";
import { Headshot } from "./Headshot";

type Props = {
  clues: Record<Slot, Clue>;
  lineup: Partial<Record<Slot, SFPlayer>>;
  /** The revealed player waiting for a slot */
  pending: SFPlayer | null;
  preview: Slot | null;
  busy: boolean;
  dragOver: Slot | null;
  onPreview: (s: Slot) => void;
  onLock: (s: Slot) => void;
  result?: { mystery: Lineup; game: GameResult };
};

function Lock() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-label="Locked">
      <rect x="2.5" y="7" width="11" height="7.5" rx="2" fill="var(--color-ink)" />
      <path d="M5 7V5.2a3 3 0 0 1 6 0V7" fill="none" stroke="var(--color-ink)" strokeWidth="2" />
    </svg>
  );
}

function BoxLine({ b }: { b: PlayerBox }) {
  return (
    <span className="tnum text-xs font-semibold text-ink-soft">
      <span className="varsity text-sm text-ink">{b.pts}</span> pts · {b.reb} reb · {b.ast} ast
    </span>
  );
}

export function SlotBadge({ slot, active }: { slot: Slot; active?: boolean }) {
  return (
    <span
      className={`varsity grid h-12 w-12 shrink-0 place-items-center rounded-full border-[2.5px] border-ink text-[17px] shadow-[2px_3px_0_0_var(--color-ink)] transition-colors ${
        active ? "bg-coral text-white" : "bg-sky text-ink"
      }`}
    >
      {slot}
    </span>
  );
}

/** Five rows: your slot, the matchup, and the Mystery Five's clue (revealed after the game). */
export function LineupBoard({ clues, lineup, pending, preview, busy, dragOver, onPreview, onLock, result }: Props) {
  return (
    <ol className="grid gap-2.5" aria-label="Your lineup against the Mystery Five">
      {SLOTS.map((slot, i) => {
        const mine = lineup[slot];
        const open = !mine && !!pending && !result;
        const previewing = open && preview === slot;
        const theirs = result?.mystery[slot];
        return (
          <li
            key={slot}
            data-slot={open ? slot : undefined}
            className={`grid grid-cols-[3rem_1fr_auto_1fr] items-center gap-2 rounded-[20px] border-[2.5px] border-ink bg-white p-2 sm:gap-3 sm:p-2.5 ${
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
                    <p className="flex items-center gap-1.5 truncate font-bold leading-tight">
                      <span className="truncate">{mine.name}</span>
                      {!result && <Lock />}
                    </p>
                    {result ? (
                      <BoxLine b={result.game.home.players[slot]} />
                    ) : (
                      <p className="truncate text-xs text-ink-soft">
                        {mine.pos}, prime {formatPrime(mine.prime)}
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : previewing ? (
                <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="truncate font-bold text-ink/60">{pending!.name}</span>
                  <button
                    type="button"
                    className="btn btn-coral px-3 py-1 text-sm"
                    disabled={busy}
                    onClick={() => onLock(slot)}
                  >
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

            <span className="varsity px-0.5 text-xs text-ink-soft" aria-hidden>
              vs
            </span>

            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                {theirs ? (
                  <motion.div
                    key="revealed"
                    initial={{ rotateX: 90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    transition={{ delay: 0.12 * i, type: "spring", stiffness: 260, damping: 22 }}
                    className="flex min-w-0 items-center gap-2 rounded-xl bg-ink px-2 py-1.5 text-white sm:px-2.5"
                  >
                    <Headshot player={theirs} size="sm" className="hidden border-white sm:grid" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold leading-tight">{theirs.name}</p>
                      <span className="tnum text-xs text-sky">
                        <span className="varsity text-sm text-white">{result!.game.away.players[slot].pts}</span> pts ·{" "}
                        {result!.game.away.players[slot].reb} reb · {result!.game.away.players[slot].ast} ast
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="clue" exit={{ rotateX: -90, opacity: 0 }} className="min-w-0 rounded-xl bg-ink px-3 py-1.5 text-white">
                    <p className="text-[11px] font-semibold text-sky">{clues[slot].era}</p>
                    <p className="truncate text-sm font-bold leading-tight">{clues[slot].archetype}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
