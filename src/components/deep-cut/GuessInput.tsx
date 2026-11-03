"use client";

import { motion, useAnimationControls } from "motion/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type GuessInputHandle = { reject: (message: string, guess: string) => void; clear: () => void };

/** A digital shot clock. */
export function ShotClock({ seconds, live }: { seconds: number; live: boolean }) {
  const hurry = live && seconds <= 5;
  return (
    <div
      role="timer"
      aria-label={`${seconds} seconds on the shot clock`}
      className={`grid h-14 w-16 shrink-0 place-items-center rounded-2xl border-[2.5px] border-ink bg-ink shadow-[var(--shadow-pop-sm)] ${hurry ? "dc-hurry" : ""}`}
    >
      <span className={`varsity tnum text-3xl leading-none ${hurry ? "text-coral" : "text-butter"}`}>{String(Math.max(0, seconds)).padStart(2, "0")}</span>
    </div>
  );
}

/**
 * Type a name and shoot. No list to pick from: spelling slips are fixed on the server, and a guess
 * that doesn't count just bounces off (with a shake) so you can shoot again while the clock runs.
 */
export const GuessInput = forwardRef<
  GuessInputHandle,
  { disabled: boolean; seconds: number; live: boolean; onShoot: (text: string) => void; onPass: () => void }
>(function GuessInput({ disabled, seconds, live, onShoot, onPass }, ref) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [misses, setMisses] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const shake = useAnimationControls();
  useImperativeHandle(ref, () => ({
    reject(message, guess) {
      setMsg(message);
      setMisses((m) => [...m, guess].slice(-6));
      setText("");
      void shake.start({ x: [0, -14, 12, -9, 6, -3, 0], transition: { duration: 0.42 } });
      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    },
    clear() {
      setText("");
      setMsg(null);
      setMisses([]);
    },
  }));
  useEffect(() => {
    if (!disabled && live) input.current?.focus({ preventScroll: true });
  }, [disabled, live]);
  const shoot = () => {
    const t = text.trim();
    if (!t || disabled || !live) return;
    setMsg(null);
    onShoot(t);
  };
  return (
    <div>
      <motion.form
        animate={shake}
        onSubmit={(e) => {
          e.preventDefault();
          shoot();
        }}
        className="flex items-center gap-2"
      >
        <ShotClock seconds={seconds} live={live} />
        <input
          ref={input}
          type="text"
          aria-label="Name a player"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={60}
          disabled={disabled || !live}
          value={text}
          placeholder={live ? "Name a player…" : "Get set…"}
          onChange={(e) => {
            setText(e.target.value);
            if (msg) setMsg(null);
          }}
          className={`h-14 min-w-0 flex-1 rounded-2xl border-[2.5px] bg-white px-4 text-lg font-bold shadow-[var(--shadow-pop-sm)] outline-none placeholder:font-semibold placeholder:text-ink-soft/70 focus:ring-4 focus:ring-sky disabled:opacity-70 ${
            msg ? "border-coral-deep" : "border-ink"
          }`}
        />
        <button type="submit" className="btn btn-coral h-14 shrink-0 px-4 text-lg sm:px-6" disabled={disabled || !live || !text.trim()}>
          Shoot
        </button>
      </motion.form>
      <div className="mt-2 flex min-h-7 flex-wrap items-center gap-1.5 text-sm">
        {msg && (
          <motion.span key={msg + misses.length} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="font-extrabold text-coral-deep" role="status">
            {msg}
          </motion.span>
        )}
        {misses.map((m, i) => (
          <span key={i} className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-ink-soft line-through decoration-coral-deep decoration-2">
            {m}
          </span>
        ))}
        <button type="button" className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-ink-soft underline decoration-2 underline-offset-2 hover:text-ink" disabled={disabled || !live} onClick={onPass}>
          Pass
        </button>
      </div>
    </div>
  );
});
