/** Small illustrated previews of each game for the home cards. Decorative only. */

export function TriviaPreview() {
  return (
    <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
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
    <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
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

export function DeepCutPreview() {
  // A prompt, a typed answer, and the shot spot creeping out past the three-point line.
  return (
    <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <rect x="0" y="0" width="400" height="150" fill="var(--color-sky)" />
      <g fill="none" stroke="#fff" strokeWidth="3" opacity="0.9">
        <path d="M0 22 H400 M0 128 H400" />
        <path d="M0 52 H76 V98 H0" />
        <path d="M0 30 H66 A70 70 0 0 1 66 120 H0" />
        <path d="M282 22 V128" />
        <circle cx="282" cy="75" r="22" />
      </g>
      <circle cx="16" cy="75" r="5" fill="none" stroke="var(--color-coral)" strokeWidth="3" />
      <path d="M16 75 H214" stroke="var(--color-coral)" strokeWidth="4" strokeDasharray="1 9" strokeLinecap="round" />
      <circle cx="214" cy="75" r="15" fill="var(--color-coral)" opacity="0.3" />
      <circle cx="214" cy="75" r="9" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" />
      <rect x="196" y="12" width="190" height="36" rx="12" fill="var(--color-ink)" transform="translate(3 4)" />
      <rect x="196" y="12" width="190" height="36" rx="12" fill="#fff" stroke="var(--color-ink)" strokeWidth="2.5" />
      <text x="208" y="35" fontSize="12.5" fontWeight="800" fill="var(--color-ink)" style={{ fontFamily: "var(--font-sans)" }}>
        Name a former #1 pick
      </text>
      {[
        ["Layup", "var(--color-sky-soft)", 10],
        ["Three", "var(--color-butter)", 60],
        ["Half-Court", "var(--color-ink)", 100],
      ].map(([label, fill, pts], i) => (
        <g key={i} transform={`translate(${36 + i * 112} 104)`}>
          <rect x="3" y="4" width="100" height="26" rx="13" fill="var(--color-ink)" />
          <rect width="100" height="26" rx="13" fill={fill as string} stroke="var(--color-ink)" strokeWidth="2.5" />
          <text x="50" y="18" textAnchor="middle" fontSize="11" fill={i === 2 ? "#fff" : "var(--color-ink)"} style={{ fontFamily: "var(--font-display)" }}>
            {`${label} ${pts}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function StartingFivePreview() {
  // Five slots on a half-court.
  return (
    <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <rect x="0" y="0" width="400" height="150" fill="var(--color-sky)" />
      <g fill="none" stroke="#fff" strokeWidth="3" opacity="0.85">
        <path d="M70 150 V110 A130 130 0 0 1 330 110 V150" />
        <rect x="160" y="78" width="80" height="72" />
        <circle cx="200" cy="78" r="26" />
      </g>
      {["PG", "SG", "SF", "PF", "C"].map((slot, i) => {
        const [x, y] = [[200, 34], [306, 64], [94, 64], [268, 118], [132, 118]][i];
        return (
          <g key={slot}>
            <circle cx={x + 2.5} cy={y + 3.5} r="21" fill="var(--color-ink)" />
            <circle cx={x} cy={y} r="21" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" />
            <text x={x} y={y + 5.5} textAnchor="middle" fontSize="15" fill="var(--color-ink)" style={{ fontFamily: "var(--font-display)" }}>
              {slot}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The featured card's art: a top-down court, the rim, your shot spot out past the arc, and the tier tag. */
export function DeepCutFeature() {
  return (
    <svg viewBox="0 0 520 220" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <rect width="520" height="220" fill="var(--color-ink)" />
      <rect x="0" y="16" width="520" height="188" fill="var(--color-sky)" />
      {Array.from({ length: 26 }, (_, i) => (
        <rect key={i} x={0} y={16 + i * 7.3} width="520" height="3.6" fill="#fff" opacity="0.06" />
      ))}
      <g fill="none" stroke="#fff" strokeWidth="3.5" opacity="0.95">
        <path d="M0 16 H520 M0 204 H520" />
        <rect x="0" y="78" width="96" height="64" fill="var(--color-sky-deep)" fillOpacity="0.5" />
        <path d="M96 86 A24 24 0 0 1 96 134" />
        <path d="M0 26 H54 A140 140 0 0 1 54 194 H0" />
        <path d="M402 16 V204" />
        <circle cx="402" cy="110" r="36" fill="var(--color-sky-soft)" />
      </g>
      <text x="404" y="124" textAnchor="middle" fontSize="40" fill="var(--color-coral)" style={{ fontFamily: "var(--font-display)" }}>
        3
      </text>
      <circle cx="22" cy="110" r="7" fill="none" stroke="var(--color-coral)" strokeWidth="3.5" />
      <path d="M30 110 H300" stroke="var(--color-coral)" strokeWidth="4" strokeDasharray="1 10" strokeLinecap="round" />
      <path d="M318 40 V196" stroke="#fff" strokeWidth="2.5" strokeDasharray="7 6" opacity="0.9" />
      <circle cx="318" cy="110" r="24" fill="var(--color-coral)" opacity="0.3" />
      <circle cx="318" cy="110" r="15" fill="#f28a3c" stroke="var(--color-ink)" strokeWidth="3.5" />
      <path d="M303 110 H333 M318 95 V125" stroke="var(--color-ink)" strokeWidth="2.5" />
      <g transform="translate(238 34)">
        <rect x="3" y="4" width="160" height="30" rx="15" fill="var(--color-ink)" />
        <rect width="160" height="30" rx="15" fill="var(--color-ink)" stroke="#fff" strokeWidth="2" />
        <text x="80" y="20" textAnchor="middle" fontSize="13" fill="#fff" letterSpacing="1" style={{ fontFamily: "var(--font-display)" }}>
          HALF-COURT · 100
        </text>
      </g>
      <g transform="translate(212 160)">
        <rect x="3" y="4" width="212" height="30" rx="15" fill="var(--color-ink)" />
        <rect width="212" height="30" rx="15" fill="#fff" stroke="var(--color-ink)" strokeWidth="2.5" />
        <text x="106" y="20" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--color-ink)" style={{ fontFamily: "var(--font-sans)" }}>
          The rarer, the deeper
        </text>
      </g>
    </svg>
  );
}
