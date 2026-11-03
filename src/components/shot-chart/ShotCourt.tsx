"use client";

import { useState } from "react";
import type { ZoneId } from "@/games/shot-chart/types";

export type ServedZone = { a: number; m: number; pct: number | null; rel: number | null; share: number };

// Half court, 10px per foot, hoop at the top. "Left" zones are the shooter's left (screen left).
const W = 500;
const H = 470;
const HOOP = { x: 250, y: 52.5 };
const ARC_R = 237.5;

const ZONE_NAMES: Record<ZoneId, string> = {
  ra: "Restricted area",
  paint: "Paint",
  mid_lb: "Left baseline (mid-range)",
  mid_lw: "Left wing (mid-range)",
  mid_c: "Top of the key (mid-range)",
  mid_rw: "Right wing (mid-range)",
  mid_rb: "Right baseline (mid-range)",
  c3_l: "Left corner 3",
  c3_r: "Right corner 3",
  atb_l: "Left wing 3",
  atb_c: "Top 3",
  atb_r: "Right wing 3",
};

const LABEL_AT: Record<ZoneId, [number, number]> = {
  ra: [250, 78],
  paint: [250, 165],
  mid_lb: [105, 70],
  mid_lw: [118, 200],
  mid_c: [250, 255],
  mid_rw: [382, 200],
  mid_rb: [395, 70],
  c3_l: [15, 60],
  c3_r: [485, 60],
  atb_l: [68, 330],
  atb_c: [250, 385],
  atb_r: [432, 330],
};

/** A wedge from the hoop between two angles (degrees; 0 = straight out, negative = screen left). */
function wedge(a1: number, a2: number): string {
  const pts = [`${HOOP.x},${HOOP.y}`];
  const steps = Math.max(1, Math.ceil((a2 - a1) / 10));
  for (let k = 0; k <= steps; k++) {
    const r = ((a1 + ((a2 - a1) * k) / steps) * Math.PI) / 180;
    pts.push(`${HOOP.x + 1200 * Math.sin(r)},${HOOP.y + 1200 * Math.cos(r)}`);
  }
  return `M${pts.join(" L")} Z`;
}

const COLD = [62, 124, 194];
const NEUTRAL = [243, 238, 230];
const HOT = [229, 83, 63];

/** Hot/cold vs league average in that zone, faded when he barely shot there. */
export function zoneFill(z: ServedZone): { fill: string; opacity: number } {
  if (!z.a || z.rel == null) return { fill: "#ffffff", opacity: 0.35 };
  const t = Math.max(-1, Math.min(1, z.rel / 8));
  const [from, to] = t < 0 ? [NEUTRAL, COLD] : [NEUTRAL, HOT];
  const k = Math.abs(t);
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * k));
  return { fill: `rgb(${c.join(",")})`, opacity: 0.35 + 0.65 * Math.min(1, z.share / 0.18) };
}

export function ShotCourt({ zones, fga, fgPct }: { zones: Record<ZoneId, ServedZone>; fga: number; fgPct: number }) {
  const [focus, setFocus] = useState<ZoneId | null>(null);
  const shape = (id: ZoneId) => {
    const { fill, opacity } = zoneFill(zones[id]);
    return {
      fill,
      fillOpacity: opacity,
      onClick: () => setFocus((f) => (f === id ? null : id)),
      onMouseEnter: () => setFocus(id),
      className: "cursor-pointer",
      stroke: focus === id ? "var(--color-ink)" : "none",
      strokeWidth: focus === id ? 4 : 0,
    } as const;
  };
  const z = focus ? zones[focus] : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full rounded-[20px] border-[2.5px] border-ink bg-white" role="img" aria-label="Shot chart by court zone">
        <defs>
          <clipPath id="court">
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
          <clipPath id="inside-arc">
            <path d={`M30,0 L30,140 A${ARC_R},${ARC_R} 0 0 0 470,140 L470,0 Z`} />
          </clipPath>
        </defs>
        <g clipPath="url(#court)">
          {/* above the break, then corners, then mid-range inside the arc, paint, restricted area */}
          <path d={wedge(-180, -22.5)} {...shape("atb_l")} />
          <path d={wedge(-22.5, 22.5)} {...shape("atb_c")} />
          <path d={wedge(22.5, 180)} {...shape("atb_r")} />
          <rect x="0" y="0" width="30" height="140" {...shape("c3_l")} />
          <rect x="470" y="0" width="30" height="140" {...shape("c3_r")} />
          <g clipPath="url(#inside-arc)">
            <rect x="0" y="0" width={W} height={H} fill="#fff" />
            <path d={wedge(-180, -67.5)} {...shape("mid_lb")} />
            <path d={wedge(-67.5, -22.5)} {...shape("mid_lw")} />
            <path d={wedge(-22.5, 22.5)} {...shape("mid_c")} />
            <path d={wedge(22.5, 67.5)} {...shape("mid_rw")} />
            <path d={wedge(67.5, 180)} {...shape("mid_rb")} />
          </g>
          <rect x="170" y="0" width="160" height="190" fill="#fff" />
          <rect x="170" y="0" width="160" height="190" {...shape("paint")} />
          <circle cx={HOOP.x} cy={HOOP.y} r="40" fill="#fff" />
          <circle cx={HOOP.x} cy={HOOP.y} r="40" {...shape("ra")} />
        </g>
        {/* court lines */}
        <g fill="none" stroke="var(--color-ink)" strokeWidth="2.5" pointerEvents="none">
          <rect x="1.25" y="1.25" width={W - 2.5} height={H - 2.5} />
          <path d={`M30,0 L30,140 A${ARC_R},${ARC_R} 0 0 0 470,140 L470,0`} />
          <rect x="170" y="0" width="160" height="190" />
          <circle cx="250" cy="190" r="60" />
          <path d={`M210,${HOOP.y} A40,40 0 0 0 290,${HOOP.y}`} />
          <line x1="220" y1="40" x2="280" y2="40" strokeWidth="3.5" />
          <circle cx={HOOP.x} cy={HOOP.y} r="7.5" stroke="var(--color-coral-deep)" />
          <path d={`M190,${H} A60,60 0 0 1 310,${H}`} />
        </g>
        {/* labels: share of his shots from each zone */}
        <g pointerEvents="none" style={{ fontFamily: "var(--font-display)" }} fill="var(--color-ink)" textAnchor="middle">
          {(Object.keys(LABEL_AT) as ZoneId[]).map((id) => {
            const [x, y] = LABEL_AT[id];
            const corner = id === "c3_l" || id === "c3_r";
            const share = zones[id].a ? `${Math.round(zones[id].share * 100)}%` : "–";
            return corner ? (
              <text key={id} x={x} y={y} fontSize="15" transform={`rotate(-90 ${x} ${y})`} dy="0.35em">
                {share}
              </text>
            ) : (
              <g key={id}>
                <text x={x} y={y} fontSize="22">
                  {share}
                </text>
                {zones[id].pct != null && (
                  <text x={x} y={y + 20} fontSize="13" opacity="0.75">
                    {(zones[id].pct! * 100).toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-semibold" aria-live="polite">
          {focus && z ? (
            <>
              {ZONE_NAMES[focus]}: {z.m}/{z.a}
              {z.pct != null && ` (${(z.pct * 100).toFixed(1)}%)`}
              {z.rel != null && (
                <span className={z.rel >= 0 ? "text-coral-deep" : "text-sky-deep"}>
                  {" "}
                  {z.rel >= 0 ? "+" : ""}
                  {z.rel.toFixed(1)} vs league
                </span>
              )}
            </>
          ) : (
            <>
              {fga.toLocaleString()} shots, {(fgPct * 100).toFixed(1)}% from the field. Tap a zone.
            </>
          )}
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
          <span>Cold</span>
          <span className="h-3 w-24 rounded-full border-2 border-ink" style={{ background: "linear-gradient(90deg, rgb(62,124,194), rgb(243,238,230), rgb(229,83,63))" }} />
          <span>Hot vs league</span>
          <span className="ml-2">Faint = few shots</span>
        </div>
      </div>
    </div>
  );
}
