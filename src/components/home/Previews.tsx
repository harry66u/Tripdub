/** Small illustrated previews of each game for the home cards. Decorative only. */

export function TriviaPreview() {
  return (
    <svg viewBox="0 0 400 150" className="h-full w-full" aria-hidden>
      <rect x="0" y="0" width="400" height="150" fill="var(--color-sky)" />
      <rect x="40" y="18" width="266" height="10" rx="5" fill="#fff" stroke="var(--color-ink)" strokeWidth="2.5" />
      <rect x="40" y="18" width="180" height="10" rx="5" fill="var(--color-coral)" />
      <text x="40" y="54" fontSize="15" fontWeight="800" fill="var(--color-ink)" style={{ fontFamily: "var(--font-sans)" }}>
        Who was named MVP for the 2015–16 season?
      </text>
      {[
        [40, 68, "Stephen Curry", true],
        [210, 68, "Kawhi Leonard", false],
        [40, 106, "LeBron James", false],
        [210, 106, "Russell Westbrook", false],
      ].map(([x, y, label, right], i) => (
        <g key={i}>
          <rect x={(x as number) + 3} y={(y as number) + 4} width="150" height="30" rx="12" fill="var(--color-ink)" />
          <rect x={x as number} y={y as number} width="150" height="30" rx="12" fill={right ? "var(--color-mint)" : "#fff"} stroke="var(--color-ink)" strokeWidth="2.5" />
          <text x={(x as number) + 14} y={(y as number) + 20} fontSize="12.5" fontWeight="700" fill="var(--color-ink)" style={{ fontFamily: "var(--font-sans)" }}>
            {label as string}
          </text>
        </g>
      ))}
      <rect x="316" y="13" width="44" height="20" rx="10" fill="var(--color-ink)" />
      <text x="338" y="27" textAnchor="middle" fontSize="11" fill="#fff" style={{ fontFamily: "var(--font-display)" }}>
        +287
      </text>
    </svg>
  );
}

export function ShotChartPreview() {
  // A tiny hot/cold court: hoop at the top.
  return (
    <svg viewBox="0 0 400 150" className="h-full w-full" aria-hidden>
      <rect x="0" y="0" width="400" height="150" fill="var(--color-sky)" />
      <g transform="translate(110 8) scale(0.38)">
        <clipPath id="pv-court">
          <rect x="0" y="0" width="500" height="350" />
        </clipPath>
        <g clipPath="url(#pv-court)">
          <rect x="0" y="0" width="500" height="350" fill="#fff" />
          <path d="M250,52 L-900,1000 L250,1000 Z" fill="rgb(229,83,63)" fillOpacity="0.85" />
          <path d="M250,52 L250,1000 L1400,1000 Z" fill="rgb(62,124,194)" fillOpacity="0.7" />
          <path d="M30,0 L30,140 A237.5,237.5 0 0 0 470,140 L470,0 Z" fill="rgb(243,238,230)" />
          <path d="M250,52 L-500,-300 L-500,120 Z" fill="rgb(229,83,63)" fillOpacity="0.5" />
          <rect x="170" y="0" width="160" height="190" fill="rgb(62,124,194)" fillOpacity="0.55" />
          <circle cx="250" cy="52" r="40" fill="rgb(229,83,63)" />
        </g>
        <g fill="none" stroke="var(--color-ink)" strokeWidth="6">
          <rect x="3" y="3" width="494" height="344" rx="10" />
          <path d="M30,0 L30,140 A237.5,237.5 0 0 0 470,140 L470,0" />
          <rect x="170" y="0" width="160" height="190" />
          <circle cx="250" cy="52" r="9" />
        </g>
        <g style={{ fontFamily: "var(--font-display)" }} fontSize="34" fill="var(--color-ink)" textAnchor="middle">
          <text x="250" y="88">142/221</text>
          <text x="110" y="300">48/119</text>
          <text x="400" y="300">31/96</text>
        </g>
      </g>
    </svg>
  );
}
