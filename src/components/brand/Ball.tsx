type BallProps = {
  cx: number;
  cy: number;
  r: number;
  /** Hard offset shadow, as a fraction of the radius. */
  shadow?: number;
  className?: string;
};

/**
 * The Tripdub ball: coral fill, navy outline, seams bowing toward the centre.
 * Drawn in unit space so it scales cleanly from favicon to hero.
 */
export function Ball({ cx, cy, r, shadow = 0, className }: BallProps) {
  const sw = r * 0.09;
  const seam = r * 0.075;
  const p = (x: number, y: number) => `${cx + x * r},${cy + y * r}`;
  return (
    <g className={className}>
      {shadow > 0 && (
        <circle cx={cx + r * shadow} cy={cy + r * shadow} r={r + sw / 2} fill="var(--color-ink)" />
      )}
      <circle cx={cx} cy={cy} r={r} fill="var(--color-coral)" stroke="var(--color-ink)" strokeWidth={sw} />
      <g fill="none" stroke="var(--color-ink)" strokeWidth={seam} strokeLinecap="round">
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
        <path d={`M${p(-0.62, -0.78)} Q${p(-0.2, 0)} ${p(-0.62, 0.78)}`} />
        <path d={`M${p(0.62, -0.78)} Q${p(0.2, 0)} ${p(0.62, 0.78)}`} />
      </g>
    </g>
  );
}

export function Star({ cx, cy, r, className }: { cx: number; cy: number; r: number; className?: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <polygon
      className={className}
      points={pts.join(" ")}
      fill="#fff"
      stroke="var(--color-ink)"
      strokeWidth={r * 0.22}
      strokeLinejoin="round"
    />
  );
}
