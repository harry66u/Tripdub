"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useRef } from "react";
import {
  MAX_FEET,
  RIM_TO_BASELINE_FT,
  RIM_TO_FREE_THROW_FT,
  RIM_TO_HALF_COURT_FT,
  RIM_TO_LOGO_FT,
  RIM_TO_THREE_FT,
} from "@/games/deep-cut/engine/scoring";
import type { Tier } from "@/games/deep-cut/types";

/**
 * The range meter: a half-court drawn to scale, seen from above, with the player's shot spot
 * moving out from the rim as they score (10 points = 1 foot). Past half-court it keeps going.
 */

const LEN = 80; // feet of floor shown, from our baseline
const RIM = RIM_TO_BASELINE_FT;
type Orient = "vertical" | "horizontal";

/** u = feet from our baseline, v = feet left/right of the middle */
function pt(o: Orient, u: number, v: number): [number, number] {
  return o === "vertical" ? [250 + v * 10, LEN * 10 - u * 10] : [u * 10, 250 - v * 10];
}
function path(o: Orient, pts: [number, number][]) {
  return pts.map(([u, v], i) => `${i ? "L" : "M"}${pt(o, u, v).map((n) => n.toFixed(1)).join(" ")}`).join(" ");
}
function arc(o: Orient, cu: number, r: number, from: number, to: number, steps = 40): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push([cu + r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

function Court({ o }: { o: Orient }) {
  const threeCorner = 22;
  const meet = Math.sqrt(RIM_TO_THREE_FT ** 2 - threeCorner ** 2);
  const a3 = Math.atan2(threeCorner, meet);
  const farRim = 94 - RIM;
  const half = 47;
  const line = { fill: "none", stroke: "#fff", strokeWidth: 4, strokeLinejoin: "round" as const };
  return (
    <g>
      {/* paint */}
      <path d={path(o, [[0, -8], [19, -8], [19, 8], [0, 8], [0, -8]])} fill="var(--color-sky-deep)" opacity="0.45" />
      <path d={path(o, [[0, -8], [19, -8], [19, 8], [0, 8]])} {...line} />
      <path d={path(o, arc(o, 19, 6, -Math.PI / 2, Math.PI / 2))} {...line} />
      {/* three-point line */}
      <path d={path(o, [[0, -threeCorner], [RIM + meet, -threeCorner], ...arc(o, RIM, RIM_TO_THREE_FT, -a3, a3), [0, threeCorner]])} {...line} />
      {/* restricted area, backboard, rim */}
      <path d={path(o, arc(o, RIM, 4, -Math.PI / 2, Math.PI / 2, 20))} {...line} strokeWidth={3} />
      <path d={path(o, [[4, -3], [4, 3]])} stroke="#fff" strokeWidth={6} />
      <circle cx={pt(o, RIM, 0)[0]} cy={pt(o, RIM, 0)[1]} r={9} fill="none" stroke="var(--color-coral)" strokeWidth={4} />
      {/* half-court line, center circle and the logo */}
      <path d={path(o, [[half, -25], [half, 25]])} {...line} />
      <circle cx={pt(o, half, 0)[0]} cy={pt(o, half, 0)[1]} r={60} fill="var(--color-sky-soft)" stroke="#fff" strokeWidth={4} />
      <text
        x={pt(o, half, 0)[0]}
        y={pt(o, half, 0)[1] + 17}
        textAnchor="middle"
        fontSize="50"
        fill="var(--color-ink)"
        opacity="0.55"
        style={{ fontFamily: "var(--font-display)" }}
      >
        3
      </text>
      {/* the other end: their three-point arc and free-throw circle */}
      <path d={path(o, arc(o, farRim, RIM_TO_THREE_FT, Math.PI - a3, Math.PI + a3))} {...line} opacity={0.6} />
      <path d={path(o, [[94 - 19, -8], [94 - 19, 8]])} {...line} opacity={0.6} />
      <path d={path(o, arc(o, 94 - 19, 6, Math.PI / 2, (3 * Math.PI) / 2))} {...line} opacity={0.6} />
      <path d={path(o, [[94 - 19, -8], [LEN, -8]])} {...line} opacity={0.6} />
      <path d={path(o, [[94 - 19, 8], [LEN, 8]])} {...line} opacity={0.6} />
      {/* sidelines + baseline */}
      <path d={path(o, [[LEN, -25], [0, -25], [0, 25], [LEN, 25]])} {...line} strokeWidth={6} />
    </g>
  );
}

const MARKS: { ft: number; label: string }[] = [
  { ft: RIM_TO_FREE_THROW_FT, label: "FT" },
  { ft: RIM_TO_THREE_FT, label: "3PT" },
  { ft: RIM_TO_LOGO_FT, label: "LOGO" },
  { ft: RIM_TO_HALF_COURT_FT, label: "HALF" },
  { ft: MAX_FEET, label: "70 FT" },
];

/** Hang time and arc height of the shot: a layup is a flick, half-court is a moonball. */
export const SHOT_STYLE: Record<Tier | "miss", { lift: number; duration: number }> = {
  miss: { lift: 0, duration: 0.5 },
  layup: { lift: 0.15, duration: 0.45 },
  toocute: { lift: 0.25, duration: 0.55 },
  midrange: { lift: 0.45, duration: 0.7 },
  three: { lift: 0.75, duration: 0.85 },
  logo: { lift: 1.1, duration: 1.0 },
  halfcourt: { lift: 1.6, duration: 1.25 },
};

export function RangeMeter({
  feet,
  orientation = "vertical",
  shot,
  className = "",
  label = true,
}: {
  /** Current range in feet from the rim */
  feet: number;
  orientation?: Orient;
  /** Set when an answer lands: plays the shot from the new spot. Change `key` to replay. */
  shot?: { tier: Tier | null; id: number } | null;
  className?: string;
  label?: boolean;
}) {
  const o = orientation;
  const reduce = useReducedMotion();
  const clipId = useId();
  const ft = useMotionValue(feet);
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reduce) {
      ft.set(feet);
      first.current = false;
      return;
    }
    const style = SHOT_STYLE[shot?.tier ?? "miss"];
    const c = animate(ft, feet, { duration: 0.5 + style.duration * 0.6, ease: [0.2, 0.8, 0.2, 1] });
    return () => c.stop();
  }, [feet, ft, reduce, shot?.tier]);

  const u = useTransform(ft, (f) => Math.min(LEN - 1, RIM + Math.max(0, f)));
  const mx = useTransform(u, (x) => pt(o, x, 0)[0]);
  const my = useTransform(u, (x) => pt(o, x, 0)[1]);
  const [rx, ry] = pt(o, RIM, 0);
  const trail = useTransform(u, (x) => {
    const [a, b] = pt(o, RIM, 0);
    const [c, d] = pt(o, x, 0);
    return `M${a} ${b} L${c} ${d}`;
  });
  const vb = o === "vertical" ? "0 0 500 800" : "0 0 800 500";
  const style = SHOT_STYLE[shot?.tier ?? "miss"];

  return (
    <svg viewBox={vb} className={className} role="img" aria-label={`Range: ${feet} feet from the rim`}>
      <clipPath id={clipId}>
        <rect x="0" y="0" width={o === "vertical" ? 500 : 800} height={o === "vertical" ? 800 : 500} rx="28" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100%" height="100%" fill="var(--color-sky)" />
        {/* the far half fades: you're shooting from beyond half-court */}
        <rect
          x={o === "vertical" ? 0 : 470}
          y={0}
          width={o === "vertical" ? 500 : 330}
          height={o === "vertical" ? 330 : 500}
          fill="var(--color-ink)"
          opacity="0.08"
        />
        <Court o={o} />
        {label &&
          MARKS.map((m) => {
            const [x, y] = pt(o, RIM + m.ft, 24);
            return (
              <text
                key={m.label}
                x={o === "vertical" ? 20 : x}
                y={o === "vertical" ? y + 8 : 30}
                textAnchor={o === "vertical" ? "start" : "middle"}
                fontSize="24"
                fill="var(--color-ink)"
                opacity="0.7"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {m.label}
              </text>
            );
          })}
        <motion.path d={trail} stroke="var(--color-coral)" strokeWidth={8} strokeDasharray="2 18" strokeLinecap="round" fill="none" />
        {/* shot spot */}
        <motion.g style={{ x: mx, y: my }}>
          <circle r="34" fill="var(--color-coral)" opacity="0.25" />
          <circle r="20" fill="#fff" stroke="var(--color-ink)" strokeWidth="5" />
          <circle r="8" fill="var(--color-coral)" />
        </motion.g>
        {/* the shot: from the spot to the rim, swelling at the top of its arc */}
        {shot && !reduce && (
          <motion.g
            key={shot.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: style.duration + 0.9, times: [0, 0.05, 0.9, 1], delay: 0.5 + style.duration * 0.6 }}
          >
            <motion.g
              initial={{ x: pt(o, RIM + feet, 0)[0], y: pt(o, RIM + feet, 0)[1], scale: 1 }}
              animate={{ x: rx, y: ry, scale: [1, 1 + style.lift, 1] }}
              transition={{ duration: style.duration, ease: "easeIn", delay: 0.5 + style.duration * 0.6 }}
            >
              <circle r="16" fill="#f28a3c" stroke="var(--color-ink)" strokeWidth="4" />
              <path d="M-16 0 H16 M0 -16 V16" stroke="var(--color-ink)" strokeWidth="2.5" />
            </motion.g>
          </motion.g>
        )}
      </g>
    </svg>
  );
}
