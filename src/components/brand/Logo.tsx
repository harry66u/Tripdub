import { Ball, Star } from "./Ball";

/** Varsity lettering: white face, navy outline, solid navy extrusion. */
function VarsityText({
  children,
  depth = 4,
  strokeWidth = 5,
  ...textProps
}: React.SVGProps<SVGTextElement> & { depth?: number; strokeWidth?: number }) {
  const layers = [];
  for (let i = depth; i >= 1; i--) {
    layers.push(
      <text
        key={i}
        {...textProps}
        transform={`translate(${i * 0.75} ${i})`}
        fill="var(--color-ink)"
        stroke="var(--color-ink)"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </text>,
    );
  }
  return (
    <>
      {layers}
      <text
        {...textProps}
        fill="#fff"
        stroke="var(--color-ink)"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {children}
      </text>
    </>
  );
}

/** Full lockup: arched TRIPDUB over the ball, flanked by "Daily" and "Hoops". */
export function LogoLockup({ className, arcId = "tripdub-arc" }: { className?: string; arcId?: string }) {
  return (
    <svg viewBox="0 20 360 220" className={className} role="img" aria-label="Tripdub, daily hoops">
      <defs>
        <path id={arcId} d="M 34 158 A 176 176 0 0 1 326 158" />
      </defs>
      <VarsityText
        fontFamily="var(--font-display)"
        fontSize={56}
        letterSpacing={3}
        textAnchor="middle"
        depth={5}
        strokeWidth={6}
      >
        <textPath href={`#${arcId}`} startOffset="50%">
          TRIPDUB
        </textPath>
      </VarsityText>
      <Ball cx={180} cy={190} r={42} />
      <g fontFamily="var(--font-display)" fontSize={19} fill="var(--color-ink)" letterSpacing={1}>
        <text x={124} y={197} textAnchor="end">
          DAILY
        </text>
        <text x={236} y={197} textAnchor="start">
          HOOPS
        </text>
      </g>
    </svg>
  );
}

/** Header mark: three-star ball plus a straight varsity wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 232 56" className={className} role="img" aria-label="Tripdub">
      <Star cx={14} cy={11} r={6} />
      <Star cx={28} cy={6} r={6.5} />
      <Star cx={42} cy={11} r={6} />
      <Ball cx={28} cy={36} r={16} />
      <VarsityText
        x={56}
        y={45}
        fontFamily="var(--font-display)"
        fontSize={34}
        letterSpacing={1.5}
        depth={3}
        strokeWidth={4}
      >
        TRIPDUB
      </VarsityText>
    </svg>
  );
}
