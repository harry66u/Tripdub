"use client";

export type Mode = "daily" | "unlimited";

export function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="tablist" aria-label="Game mode" className="inline-flex rounded-full border-[2.5px] border-ink bg-white p-1 shadow-[var(--shadow-pop-sm)]">
      {(["daily", "unlimited"] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          type="button"
          onClick={() => m !== mode && onChange(m)}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${mode === m ? "bg-ink text-white" : "text-ink hover:bg-wash"}`}
        >
          {m === "daily" ? "Daily" : "Unlimited"}
        </button>
      ))}
    </div>
  );
}

export function GameHeader({
  title,
  mode,
  puzzleNumber,
  date,
  onMode,
  extra,
}: {
  title: string;
  mode: Mode;
  puzzleNumber: number | null;
  date: string | null;
  onMode: (m: Mode) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          {mode === "daily" && puzzleNumber != null && date ? (
            <>
              <span className="varsity rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">#{puzzleNumber}</span>
              {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </>
          ) : (
            <span>Unlimited: a fresh game every time</span>
          )}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ModeTabs mode={mode} onChange={onMode} />
        {extra}
      </div>
    </div>
  );
}
