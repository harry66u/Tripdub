"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ball } from "@/components/brand/Ball";
import type { WheelName } from "@/games/starting-five/api-types";

const SEGMENTS = 16;
const SEG = 360 / SEGMENTS;
const R_OUT = 200;
const R_IN = 54;
const SPIN_MS = 4800;
const SETTLE_MS = 320;

const FILL: Record<WheelName["t"], string> = {
  legend: "var(--color-butter)",
  allstar: "var(--color-coral)",
  starter: "var(--color-sky)",
  role: "#fff",
};

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function wedge(i: number): string {
  const [x0, y0] = polar(R_OUT, i * SEG);
  const [x1, y1] = polar(R_OUT, (i + 1) * SEG);
  const [x2, y2] = polar(R_IN, (i + 1) * SEG);
  const [x3, y3] = polar(R_IN, i * SEG);
  return `M${x0},${y0} A${R_OUT},${R_OUT} 0 0 1 ${x1},${y1} L${x2},${y2} A${R_IN},${R_IN} 0 0 0 ${x3},${y3} Z`;
}

/** Long, physical spin-down: quick launch, a slow crawl past the last pegs. */
function spinEase(t: number): number {
  return 1 - Math.pow(1 - t, 3.4);
}

let audio: AudioContext | null = null;
function tickSound() {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = "triangle";
    o.frequency.value = 1700;
    g.gain.setValueAtTime(0.06, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.035);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.04);
  } catch {
    /* audio unavailable */
  }
}

export type WheelProps = {
  segments: WheelName[];
  targetIndex: number;
  /** Increment to start a spin toward `targetIndex`. */
  spinKey: number;
  sound: boolean;
  onDone: () => void;
  /** Highlight the landed segment */
  landed: boolean;
};

export function Wheel({ segments, targetIndex, spinKey, sound, onDone, landed }: WheelProps) {
  const rotor = useRef<SVGGElement>(null);
  const flap = useRef<SVGGElement>(null);
  const rotation = useRef(0);
  const [settledAt, setSettledAt] = useState(0);
  const onDoneRef = useRef(onDone);
  const soundRef = useRef(sound);
  onDoneRef.current = onDone;
  soundRef.current = sound;

  const labels = useMemo(
    () =>
      segments.map((s, i) => {
        const mid = (i + 0.5) * SEG;
        const size = s.n.length > 22 ? 10.5 : s.n.length > 17 ? 12 : 13.5;
        return { ...s, mid, size };
      }),
    [segments],
  );

  useEffect(() => {
    if (!spinKey) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = rotation.current;
    const jitter = (Math.random() - 0.5) * SEG * 0.72;
    const desired = (((360 - ((targetIndex + 0.5) * SEG + jitter)) % 360) + 360) % 360;
    const delta = (((desired - (start % 360)) % 360) + 360) % 360;
    const turns = 5 + Math.floor(Math.random() * 2);
    const end = start + turns * 360 + delta;
    const apply = (deg: number) => {
      rotation.current = deg;
      rotor.current?.setAttribute("transform", `rotate(${deg})`);
    };
    if (reduce) {
      const t = setTimeout(() => {
        apply(end);
        setSettledAt(Date.now());
        onDoneRef.current();
      }, 300);
      return () => clearTimeout(t);
    }
    let raf = 0;
    let lastPeg = Math.floor(start / SEG);
    const t0 = performance.now();
    const overshoot = 1.6;
    const frame = (now: number) => {
      const el = now - t0;
      let deg: number;
      if (el < SPIN_MS) {
        deg = start + (end + overshoot - start) * spinEase(el / SPIN_MS);
      } else if (el < SPIN_MS + SETTLE_MS) {
        const k = (el - SPIN_MS) / SETTLE_MS;
        deg = end + overshoot * (1 - (1 - Math.cos(Math.PI * k)) / 2);
      } else {
        apply(end);
        setSettledAt(Date.now());
        onDoneRef.current();
        return;
      }
      apply(deg);
      const peg = Math.floor(deg / SEG);
      if (peg !== lastPeg) {
        lastPeg = peg;
        flap.current?.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(-16deg)" }, { transform: "rotate(0deg)" }],
          { duration: 110, easing: "ease-out" },
        );
        if (soundRef.current) tickSound();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // targetIndex is captured at spin start on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  return (
    <svg viewBox="-236 -246 480 486" className="block h-auto w-full select-none" role="img" aria-label="Player wheel">
      {/* retro offset shadow */}
      <circle cx={9} cy={11} r={R_OUT + 14} fill="var(--color-ink)" />
      <circle r={R_OUT + 14} fill="#fff" stroke="var(--color-ink)" strokeWidth={5} />
      <g ref={rotor} transform={`rotate(${rotation.current})`}>
        {labels.map((s, i) => (
          <g key={i}>
            <path d={wedge(i)} fill={FILL[s.t]} stroke="var(--color-ink)" strokeWidth={2.5} strokeLinejoin="round" />
            <g transform={`rotate(${s.mid > 180 ? s.mid + 90 : s.mid - 90})`}>
              <text
                x={s.mid > 180 ? -(R_OUT - 14) : R_OUT - 14}
                y={0}
                dy="0.35em"
                textAnchor={s.mid > 180 ? "start" : "end"}
                fontSize={s.size}
                fontWeight={700}
                fill="var(--color-ink)"
                style={{ fontFamily: "var(--font-sans)", letterSpacing: "0.01em" }}
              >
                {s.n}
              </text>
            </g>
          </g>
        ))}
        {landed && (
          <path
            key={settledAt}
            d={wedge(targetIndex)}
            fill="#fff"
            stroke="var(--color-ink)"
            strokeWidth={4}
            className="wheel-landed"
          />
        )}
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const [x, y] = polar(R_OUT + 7, i * SEG);
          return <circle key={i} cx={x} cy={y} r={4.2} fill="#fff" stroke="var(--color-ink)" strokeWidth={2} />;
        })}
      </g>
      {/* hub */}
      <circle r={R_IN} fill="#fff" stroke="var(--color-ink)" strokeWidth={4} />
      <Ball cx={0} cy={0} r={33} />
      {/* pointer flap, pivoting at its top */}
      <g transform={`translate(0 ${-R_OUT - 30})`}>
        <g ref={flap} style={{ transformOrigin: "50% 26%", transformBox: "fill-box" }}>
          <path
            d="M-17,-12 Q0,-22 17,-12 L3,30 Q0,35 -3,30 Z"
            transform="translate(3 4)"
            fill="var(--color-ink)"
          />
          <path
            d="M-17,-12 Q0,-22 17,-12 L3,30 Q0,35 -3,30 Z"
            fill="var(--color-coral)"
            stroke="var(--color-ink)"
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          <circle cy={-6} r={4} fill="#fff" stroke="var(--color-ink)" strokeWidth={2} />
        </g>
      </g>
    </svg>
  );
}
