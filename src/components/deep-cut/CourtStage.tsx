"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TIER_LABEL, TIER_POINTS, type Tier } from "@/games/deep-cut/types";
import { TIER_CHIP } from "./tiers";

/**
 * The court the game is played on, seen from above. The rim is at the top; your spot moves down
 * the floor as your range grows (10 points = 1 foot), and the floor scrolls with it. Every answer
 * is pinned where it landed. Distances are feet from the center of the rim.
 */

const RIM = 5.25; // rim to our baseline
const BEHIND = 16; // floor shown behind the baseline
const END = 92; // how far down the floor the world goes
const HALF_W = 34; // half the world's width, past the sidelines
const TOP = -(RIM + BEHIND);
const THREE = 23.75;
const CORNER = 22;
const MEET = Math.sqrt(THREE ** 2 - CORNER ** 2) - 0; // where the corner three meets the arc (from the rim)
const HALF = 47 - RIM; // half-court line
const FAR_RIM = 94 - 2 * RIM; // their rim

export const LANDMARKS: { ft: number; label: string }[] = [
  { ft: -RIM, label: "Baseline" },
  { ft: 4, label: "Restricted area" },
  { ft: 19 - RIM, label: "Free-throw line" },
  { ft: CORNER, label: "Corner three, 22 ft" },
  { ft: THREE, label: "Three-point line, 23′9″" },
  { ft: 29, label: "Heat-check range" },
  { ft: HALF - 6, label: "The logo" },
  { ft: HALF, label: "Half-court" },
  { ft: FAR_RIM - THREE, label: "Their three-point line" },
  { ft: 94 - 19 - RIM, label: "Their free-throw line: a perfect 700" },
];

/** How a shot travels: a layup is a flick, a half-court shot sends the floor flying. */
export const SHOT_MOTION: Record<Tier | "miss", { duration: number; hop: number }> = {
  miss: { duration: 0.4, hop: 0 },
  layup: { duration: 0.55, hop: 0.12 },
  toocute: { duration: 0.7, hop: 0.2 },
  midrange: { duration: 0.95, hop: 0.35 },
  three: { duration: 1.25, hop: 0.6 },
  logo: { duration: 1.55, hop: 0.9 },
  halfcourt: { duration: 1.9, hop: 1.3 },
};

function arc(cy: number, r: number, from: number, to: number, steps = 64) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    d += `${i ? "L" : "M"}${(r * Math.sin(a)).toFixed(3)} ${(cy + r * Math.cos(a)).toFixed(3)}`;
  }
  return d;
}

/** The floor, in feet: x across (0 = middle), y down the floor (0 = our rim). */
function Floor() {
  const a3 = Math.atan2(CORNER, MEET);
  const line = { fill: "none", stroke: "#fff", strokeWidth: 0.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const boards = [];
  for (let x = -25; x < 25; x += 1.25) boards.push(<rect key={x} x={x} y={-RIM} width={0.62} height={94} fill="#fff" opacity={0.07} />);
  return (
    <g>
      {/* out of bounds */}
      <rect x={-HALF_W} y={TOP} width={HALF_W * 2} height={END - TOP} fill="var(--color-ink)" />
      <text x={0} y={-RIM - 6} textAnchor="middle" fontSize={4.2} fill="#fff" opacity={0.16} letterSpacing={0.6} style={{ fontFamily: "var(--font-display)" }}>
        TRIPDUB
      </text>
      {/* the floor */}
      <rect x={-25} y={-RIM} width={50} height={94} fill="var(--color-sky)" />
      {boards}
      {/* our end */}
      <rect x={-8} y={-RIM} width={16} height={19} fill="var(--color-sky-deep)" opacity={0.55} />
      <path d={`M-8 ${-RIM} V${19 - RIM} H8 V${-RIM}`} {...line} />
      <path d={arc(19 - RIM, 6, -Math.PI / 2, Math.PI / 2)} {...line} />
      <path d={arc(19 - RIM, 6, Math.PI / 2, (3 * Math.PI) / 2)} {...line} strokeDasharray="1 1" opacity={0.7} />
      <path d={`M${-CORNER} ${-RIM} V${MEET} ${arc(0, THREE, -a3, a3).replace(/^M/, "L")} M${CORNER} ${MEET} V${-RIM}`} {...line} />
      <path d={arc(0, 4, -Math.PI / 2, Math.PI / 2, 24)} {...line} strokeWidth={0.15} />
      <path d={`M-3 -1.25 H3`} stroke="#fff" strokeWidth={0.35} />
      <circle cx={0} cy={0} r={0.75} fill="none" stroke="var(--color-coral)" strokeWidth={0.22} />
      {/* half-court and the logo */}
      <path d={`M-25 ${HALF} H25`} {...line} />
      <circle cx={0} cy={HALF} r={6} fill="var(--color-sky-soft)" stroke="#fff" strokeWidth={0.2} />
      <circle cx={0} cy={HALF} r={2} fill="none" stroke="#fff" strokeWidth={0.15} />
      <text x={0.35} y={HALF + 2.35} textAnchor="middle" fontSize={7} fill="var(--color-ink)" style={{ fontFamily: "var(--font-display)" }}>
        3
      </text>
      <text x={0} y={HALF + 2} textAnchor="middle" fontSize={7} fill="var(--color-coral)" style={{ fontFamily: "var(--font-display)" }}>
        3
      </text>
      {/* their end */}
      <rect x={-8} y={FAR_RIM - (19 - RIM)} width={16} height={19} fill="var(--color-sky-deep)" opacity={0.55} />
      <path d={`M-8 ${FAR_RIM + RIM} V${FAR_RIM - (19 - RIM)} H8 V${FAR_RIM + RIM}`} {...line} />
      <path d={arc(FAR_RIM - (19 - RIM), 6, Math.PI / 2, (3 * Math.PI) / 2)} {...line} />
      <path d={`M${-CORNER} ${FAR_RIM + RIM} V${FAR_RIM - MEET} ${arc(FAR_RIM, THREE, Math.PI + a3, Math.PI - a3).replace(/^M/, "L")} M${CORNER} ${FAR_RIM - MEET} V${FAR_RIM + RIM}`} {...line} />
      <circle cx={0} cy={FAR_RIM} r={0.75} fill="none" stroke="var(--color-coral)" strokeWidth={0.22} />
      {/* sidelines and baselines */}
      <rect x={-25} y={-RIM} width={50} height={94} {...line} strokeWidth={0.3} />
    </g>
  );
}

export type Landing = { feet: number; label: string; tier: Tier | null };

export function CourtStage({
  feet,
  shot,
  landings,
  anchor = 0.74,
  children,
}: {
  /** Your range in feet */
  feet: number;
  /** Changes when a shot lands, to play its motion */
  shot?: { tier: Tier | null; id: number } | null;
  /** Answers pinned on the floor where they landed */
  landings: Landing[];
  /** Where your spot sits on screen, as a fraction of the height */
  anchor?: number;
  children?: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = Math.max(16, Math.min(36, size.h / 32)); // pixels per foot
  const reduce = useReducedMotion();
  const cam = useMotionValue(feet);
  const hop = useMotionValue(1);
  useEffect(() => {
    if (reduce) {
      cam.set(feet);
      return;
    }
    const m = SHOT_MOTION[shot?.tier ?? "miss"];
    const c = animate(cam, feet, { duration: m.duration, ease: [0.22, 0.9, 0.25, 1] });
    const h = animate(hop, [1, 1 + m.hop, 1], { duration: m.duration * 0.8, ease: "easeOut" });
    return () => {
      c.stop();
      h.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feet, shot?.id, reduce]);

  const y = useTransform(cam, (f) => size.h * anchor - (f - TOP) * s);
  const worldW = HALF_W * 2 * s;
  const worldH = (END - TOP) * s;
  const at = (ft: number) => (ft - TOP) * s;

  const ticks = [];
  for (let ft = 0; ft <= 85; ft += 1) ticks.push(ft);

  return (
    <div ref={box} className="absolute inset-0 overflow-clip bg-ink">
      {/* the floor scrolls under you */}
      <motion.div className="absolute top-0 left-1/2" style={{ y, x: -worldW / 2, width: worldW, height: worldH }}>
        <svg viewBox={`${-HALF_W} ${TOP} ${HALF_W * 2} ${END - TOP}`} width={worldW} height={worldH} className="block" aria-hidden>
          <Floor />
        </svg>
      </motion.div>

      {/* distance ruler and landmarks, pinned to the screen edges */}
      <motion.div className="pointer-events-none absolute inset-x-0 top-0" style={{ y, height: worldH }} aria-hidden>
        {ticks.map((ft) => (
          <div key={ft} className="absolute right-0 flex items-center" style={{ top: at(ft) }}>
            {ft % 5 === 0 && <span className="varsity mr-2 -translate-y-1/2 text-[11px] text-white/80 sm:text-xs">{ft} FT</span>}
            <span className={`block -translate-y-1/2 bg-white/70 ${ft % 5 === 0 ? "h-[3px] w-5" : "h-[2px] w-2.5"}`} />
          </div>
        ))}
        {LANDMARKS.map((l) => (
          <div key={l.label} className="absolute left-0 flex -translate-y-1/2 items-center gap-2" style={{ top: at(l.ft) }}>
            <span className="block h-[2px] w-4 bg-white/80 sm:w-6" />
            <span className="max-w-[9rem] text-[11px] leading-tight font-semibold text-white drop-shadow-[0_1px_0_var(--color-ink)] sm:max-w-none sm:text-xs">
              {l.label}
            </span>
          </div>
        ))}
        {landings.map((l, i) => {
          if (i === landings.length - 1) {
            return (
              <div key={i} className="absolute inset-x-0 flex -translate-y-1/2 items-center justify-center gap-2 px-8 sm:px-10" style={{ top: at(l.feet) }}>
                <span className="h-0 flex-1 border-t-2 border-dashed border-white/85" />
                <span className="max-w-[40vw] truncate rounded-full border-[2.5px] border-ink bg-white px-3 py-1 text-sm font-extrabold shadow-[var(--shadow-pop-sm)]">{l.label}</span>
                <span className="h-0 w-10 border-t-2 border-dashed border-white/85 sm:w-16" />
                <span className={`varsity rounded-full border-2 border-ink px-2 py-0.5 text-[11px] whitespace-nowrap shadow-[var(--shadow-pop-sm)] ${TIER_CHIP[l.tier ?? "miss"]}`}>
                  {l.tier ? `${TIER_LABEL[l.tier]} · ${TIER_POINTS[l.tier]}` : "No good · 0"}
                </span>
                <span className="h-0 flex-1 border-t-2 border-dashed border-white/85" />
              </div>
            );
          }
          // Earlier shots: small pins, alternating sides of the lane so close ones don't collide
          const left = (landings.length - 1 - i) % 2 === 1;
          return (
            <div
              key={i}
              className={`absolute flex -translate-y-1/2 items-center gap-1.5 opacity-85 ${left ? "right-1/2 mr-7 flex-row-reverse" : "left-1/2 ml-7"}`}
              style={{ top: at(l.feet) }}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink ${TIER_CHIP[l.tier ?? "miss"].split(" ")[0]}`} />
              <span className="max-w-[30vw] truncate rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold">{l.label}</span>
            </div>
          );
        })}
      </motion.div>

      {/* you: the shot spot, which stays put while the floor moves */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: size.h * anchor }} aria-hidden>
        <motion.div style={{ scale: hop }} className="relative grid h-12 w-12 place-items-center">
          <span className="absolute inset-0 rounded-full bg-coral/30" />
          <svg viewBox="0 0 40 40" className="h-8 w-8 drop-shadow-[2px_3px_0_var(--color-ink)]">
            <circle cx="20" cy="20" r="17" fill="#f28a3c" stroke="var(--color-ink)" strokeWidth="3" />
            <path d="M3 20h34M20 3v34M8 8c6 6 6 18 0 24M32 8c-6 6-6 18 0 24" fill="none" stroke="var(--color-ink)" strokeWidth="2.2" />
          </svg>
        </motion.div>
      </div>

      {/* trail from the rim to you */}
      <motion.div
        className="pointer-events-none absolute left-1/2 w-0 -translate-x-1/2 border-l-[3px] border-dotted border-coral"
        style={{ top: useTransform(y, (v) => v + at(0)), height: useTransform(cam, (f) => Math.max(0, f * s - 24)) }}
        aria-hidden
      />
      {children}
    </div>
  );
}
