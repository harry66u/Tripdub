import { Ball } from "./Ball";

/** The varsity-3 ball from the icon set: the Tripdub badge. */
export function VarsityThree({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Tripdub">
      <Ball cx={50} cy={50} r={44} />
      <text
        x="50"
        y="69"
        textAnchor="middle"
        fontSize="58"
        fill="#fff"
        stroke="var(--color-ink)"
        strokeWidth="5"
        paintOrder="stroke"
        strokeLinejoin="round"
        style={{ fontFamily: "var(--font-display)" }}
      >
        3
      </text>
    </svg>
  );
}
