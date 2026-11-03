"use client";

import { useState } from "react";
import { shareResult } from "@/lib/client/share";

export function ShareButton({ text, label = "Share result", className = "" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      className={`btn btn-coral ${className}`}
      onClick={async () => {
        const r = await shareResult(text);
        if (r === "shared") return;
        setState(r === "copied" ? "copied" : "failed");
        setTimeout(() => setState("idle"), 2200);
      }}
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
        <path d="M10 2v11M6 6l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 11v5h12v-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span aria-live="polite">{state === "copied" ? "Copied to clipboard" : state === "failed" ? "Couldn’t copy" : label}</span>
    </button>
  );
}
