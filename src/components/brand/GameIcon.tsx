/** Small line icons for each game, drawn to match the brand (2px strokes, round joins). */
export type GameIconName = "deep" | "sf" | "trivia" | "shot";

export function GameIcon({ name, className = "h-4 w-4" }: { name: GameIconName; className?: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      {name === "deep" && (
        <>
          <path d="M3 4a7.5 7.5 0 0 0 14 0" {...s} />
          <path d="M10 4v8" {...s} strokeDasharray="1.6 2.4" />
          <circle cx="10" cy="15.5" r="2.6" fill="currentColor" />
        </>
      )}
      {name === "sf" && (
        <>
          {[
            [10, 3.5],
            [16, 8],
            [13.7, 15.5],
            [6.3, 15.5],
            [4, 8],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.3" fill="currentColor" />
          ))}
        </>
      )}
      {name === "trivia" && (
        <>
          <path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 14H9l-4 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z" {...s} />
          <path d="M8.3 7.8a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1" {...s} strokeWidth={1.7} />
          <circle cx="10" cy="12.2" r=".9" fill="currentColor" />
        </>
      )}
      {name === "shot" && (
        <>
          <path d="M2.5 3.5h15v13h-15z" {...s} />
          <path d="M6 3.5v4.5a4 4 0 0 0 8 0V3.5" {...s} />
          <circle cx="5" cy="13" r="1.3" fill="currentColor" />
          <circle cx="10" cy="11.6" r="1.3" fill="currentColor" />
          <circle cx="15" cy="13.5" r="1.3" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
