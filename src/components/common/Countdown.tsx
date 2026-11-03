"use client";

import { useEffect, useState } from "react";
import { nextResetAt } from "@/lib/day";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Time until the next daily reset (midnight ET). */
export function Countdown({ className = "", label = "Next puzzle in" }: { className?: string; label?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now == null ? null : nextResetAt(new Date(now)).getTime() - now;
  return (
    <span className={className} suppressHydrationWarning>
      {label} <span className="varsity tnum">{left == null ? "–:––:––" : fmt(left)}</span>
    </span>
  );
}
