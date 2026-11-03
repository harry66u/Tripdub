"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelName } from "@/games/starting-five/api-types";
import type { SFPlayer } from "@/games/starting-five/types";
import { Headshot, headshotUrl } from "./Headshot";

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

export type RouletteProps = {
  /** Faces to flash through before landing (decoys) */
  decoys: WheelName[];
  target: SFPlayer;
  /** Increment to start a spin toward `target`. */
  spinKey: number;
  sound: boolean;
  landed: boolean;
  onDone: () => void;
};

/**
 * Player faces flicker past, slowing down, until it lands on your player.
 * The frame sequence is fixed when the target changes, so it can't drift mid-spin.
 */
export function FaceRoulette({ decoys, target, spinKey, sound, landed, onDone }: RouletteProps) {
  const sequence = useMemo(() => {
    const pool = decoys.filter((d) => d.n !== target.name);
    const out: WheelName[] = [];
    for (let i = 0; i < FRAMES - 1 && pool.length; i++) out.push(pool[(i * 7 + target.season) % pool.length]);
    // A big name right before the landing is good suspense.
    const legend = pool.find((d) => d.t === "legend" && !out.slice(-3).includes(d));
    if (legend) out[out.length - 1] = legend;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id, decoys.length]);

  const [frame, setFrame] = useState<number>(-1); // -1 = idle, FRAMES-1 = landed on target
  const onDoneRef = useRef(onDone);
  const soundRef = useRef(sound);
  onDoneRef.current = onDone;
  soundRef.current = sound;

  // Warm the image cache so the flicker is smooth.
  useEffect(() => {
    for (const d of sequence) if (d.i != null) new Image().src = headshotUrl(d.i, "sm");
    if (target.nbaId != null) new Image().src = headshotUrl(target.nbaId, "lg");
  }, [sequence, target.nbaId]);

  useEffect(() => {
    setFrame(landed ? FRAMES - 1 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id]);

  useEffect(() => {
    if (!spinKey) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduce) {
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
          if (i === FRAMES - 1) setTimeout(() => onDoneRef.current(), 350);
        }, at),
      );
      t += FIRST_MS * GROWTH ** i;
    }
    return () => timers.forEach(clearTimeout);
  }, [spinKey]);

  const atTarget = frame === FRAMES - 1;
  const shown = frame < 0 ? null : atTarget ? null : sequence[frame];
  return (
    <div className="mx-auto w-full max-w-[440px]" aria-live="polite">
      <div
        className={`relative overflow-hidden rounded-[28px] border-[2.5px] border-ink bg-white shadow-[var(--shadow-pop)] transition-transform ${
          atTarget ? "scale-[1.02]" : ""
        }`}
      >
        {frame < 0 ? (
          <div className="relative grid h-56 place-items-center bg-sky sm:h-64">
            <CourtLines />
            <span className="varsity relative grid h-28 w-28 place-items-center rounded-full border-[2.5px] border-ink bg-white text-5xl shadow-[var(--shadow-pop-sm)]">
              ?
            </span>
          </div>
        ) : atTarget ? (
          <div className="relative">
            <Headshot player={target} size="lg" className="h-56 rounded-none border-0 sm:h-64" />
          </div>
        ) : (
          <div key={frame} className="relative h-56 bg-sky sm:h-64">
            <CourtLines />
            {shown?.i != null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={headshotUrl(shown.i, "sm")}
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-x-0 bottom-0 mx-auto h-full w-auto max-w-none object-contain object-bottom"
              />
            ) : null}
          </div>
        )}
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
