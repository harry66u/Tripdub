"use client";

import { useEffect, useRef } from "react";

const STEPS = [
  ["Spin", "Faces flash by until one lands: a real NBA player from one season, like 2016 Stephen Curry, with that season’s real numbers."],
  ["Place", "Lock him into any open slot. Each slot guards and attacks the opposing player in that same slot, and you can see exactly who they are."],
  ["Re-spin once", "Pass on one player per game."],
  ["Play", "We simulate the game 400 times. Your score is your win probability."],
] as const;

export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,520px)] rounded-[var(--radius-card)] border-[2.5px] border-ink bg-white p-0 text-ink shadow-[var(--shadow-pop-lg)] backdrop:bg-ink/40"
    >
      <div className="p-6 sm:p-7">
        <h2 className="text-2xl font-extrabold">How Starting Five works</h2>
        <ol className="mt-5 grid gap-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-3">
              <span className="varsity grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-ink bg-sky text-lg">{i + 1}</span>
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-2xl bg-wash px-4 py-3 text-sm">
          There’s no penalty for playing someone out of position. A center at point guard just has to guard their point guard.
          Daily gives everyone the same spins and opponent. Unlimited deals new ones every game.
        </p>
        <button type="button" className="btn btn-coral mt-6 w-full" onClick={onClose}>
          Let’s play
        </button>
      </div>
    </dialog>
  );
}
