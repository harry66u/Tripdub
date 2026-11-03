"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hashSeed, rng, shuffle } from "@/lib/rng";
import type { SFPlayer } from "@/games/starting-five/types";
import { Headshot, headshotUrl } from "./Headshot";
import type { Face } from "./useFacePool";

const FRAMES = 26;
const FIRST_MS = 55;
const GROWTH = 1.09;

let audio: AudioContext | null = null;
function tick(final = false) {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = final ? "sine" : "triangle";
    o.frequency.value = final ? 880 : 1500;
    g.gain.setValueAtTime(final ? 0.12 : 0.05, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (final ? 0.35 : 0.03));
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + (final ? 0.36 : 0.04));
  } catch {
    /* audio unavailable */
  }
}

function initials(name: string): string {
  const parts = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export type RouletteProps = {
  /** Faces to flash through before landing */
  faces: Face[];
  target: SFPlayer;
  /** Increment to start a spin toward `target`. */
  spinKey: number;
  sound: boolean;
  onDone: () => void;
};

/**
 * Player faces flicker past, slowing down, until it lands on your player. Every frame's image is
 * already loaded and mounted, so each flick is an instant swap, never a blank frame.
 */
export function FaceRoulette({ faces, target, spinKey, sound, onDone }: RouletteProps) {
  const sequence = useMemo(() => {
    const pool = shuffle(
      faces.filter((f) => f.n !== target.name),
      rng(hashSeed(target.id, spinKey)),
    );
    if (!pool.length) return [];
    const out: Face[] = [];
    for (let i = 0; i < FRAMES - 1; i++) out.push(pool[i % pool.length]);
    // A big name right before the landing is good suspense.
    const legend = pool.find((f) => f.t === "legend" && !out.slice(-3).includes(f));
    if (legend) out[out.length - 1] = legend;
    return out;
    // Recompute only when a new spin starts or the target changes, never mid-spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id, spinKey, faces.length > 0]);

  const [frame, setFrame] = useState(-1); // -1 = idle, FRAMES-1 = landed on target
  const onDoneRef = useRef(onDone);
  const soundRef = useRef(sound);
  onDoneRef.current = onDone;
  soundRef.current = sound;

  useEffect(() => {
    if (target.nbaId != null) new Image().src = headshotUrl(target.nbaId, "lg");
  }, [target.nbaId]);

  useEffect(() => {
    setFrame(-1);
  }, [target.id]);

  useEffect(() => {
    if (!spinKey) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduce || !sequence.length) {
      timers.push(
        setTimeout(() => {
          setFrame(FRAMES - 1);
          onDoneRef.current();
        }, 300),
      );
      return () => timers.forEach(clearTimeout);
    }
    let t = 0;
    for (let i = 0; i < FRAMES; i++) {
      const at = t;
      timers.push(
        setTimeout(() => {
          setFrame(i);
          if (soundRef.current) tick(i === FRAMES - 1);
          if (i === FRAMES - 1) timers.push(setTimeout(() => onDoneRef.current(), 380));
        }, at),
      );
      t += FIRST_MS * GROWTH ** i;
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  const atTarget = frame === FRAMES - 1;
  const spinning = frame >= 0 && !atTarget;
  const shown = spinning ? sequence[frame] : null;

  return (
    <div className="mx-auto w-full max-w-[440px]" aria-live="polite">
      <div
        className={`relative overflow-hidden rounded-[28px] border-[2.5px] border-ink bg-white shadow-[var(--shadow-pop)] transition-transform duration-200 ${
          atTarget ? "scale-[1.03]" : ""
        }`}
      >
        <div className="relative h-56 bg-sky sm:h-64">
          <CourtLines />
          {/* Idle: a teaser of faces waiting to be drawn */}
          {frame < 0 && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex -space-x-5">
                {faces.slice(0, 5).map((f, i) => (
                  <FaceBubble key={f.n} face={f} className={i === 2 ? "z-10 h-24 w-24 sm:h-28 sm:w-28" : "mt-4 h-16 w-16 opacity-80 sm:h-20 sm:w-20"} />
                ))}
              </div>
            </div>
          )}
          {/* Spinning: all frames mounted, only the current one visible */}
          {sequence.map((f, i) =>
            f.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${i}-${f.n}`}
                src={f.url}
                alt=""
                referrerPolicy="no-referrer"
                className={`absolute inset-x-0 bottom-0 mx-auto h-full w-auto max-w-none object-contain object-bottom ${
                  spinning && frame === i ? "visible" : "invisible"
                }`}
              />
            ) : spinning && frame === i ? (
              <div key={`${i}-${f.n}`} className="absolute inset-0 grid place-items-center">
                <span className="varsity grid h-28 w-28 place-items-center rounded-full border-[2.5px] border-ink bg-white text-4xl shadow-[var(--shadow-pop-sm)]">
                  {initials(f.n)}
                </span>
              </div>
            ) : null,
          )}
          {atTarget && <Headshot player={target} size="lg" className="absolute inset-0 h-full rounded-none border-0" />}
        </div>
        <div className="border-t-[2.5px] border-ink bg-white px-4 py-3 text-center">
          {atTarget ? (
            <p className="text-xl font-extrabold leading-tight">
              <span className="varsity mr-2 text-coral-deep">{target.season}</span>
              {target.name}
            </p>
          ) : (
            <p className="truncate text-xl font-extrabold leading-tight text-ink/70">{shown ? shown.n : "Who’s next?"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FaceBubble({ face, className = "" }: { face: Face; className?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border-[2.5px] border-ink bg-white shadow-[var(--shadow-pop-sm)] ${className}`}>
      {face.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={face.url} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-[1.4] object-cover object-[50%_20%] translate-y-[12%]" />
      ) : (
        <span className="varsity text-xl">{initials(face.n)}</span>
      )}
    </span>
  );
}

function CourtLines() {
  return (
    <svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <g fill="none" stroke="#fff" strokeWidth="3" opacity="0.75">
        <path d="M40 180 V120 A160 160 0 0 1 360 120 V180" />
        <rect x="140" y="70" width="120" height="110" />
        <circle cx="200" cy="70" r="40" />
      </g>
    </svg>
  );
}
