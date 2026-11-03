"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildIndex, search, type IndexEntry, type NameIndex } from "@/games/deep-cut/engine/match";
import type { DCName } from "@/games/deep-cut/types";

let cached: Promise<NameIndex> | null = null;

/** Every NBA player, loaded once per visit. */
export function loadNameIndex(): Promise<NameIndex> {
  cached ??= fetch("/api/deep-cut/names")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("names"))))
    .then((list: DCName[]) => buildIndex(list))
    .catch((e) => {
      cached = null;
      throw e;
    });
  return cached;
}

export function useNameIndex() {
  const [index, setIndex] = useState<NameIndex | null>(null);
  useEffect(() => {
    let live = true;
    loadNameIndex()
      .then((i) => live && setIndex(i))
      .catch(() => live && setIndex([]));
    return () => {
      live = false;
    };
  }, []);
  return index;
}

/**
 * Type a player, pick from the list. Enter or a tap on a suggestion shoots; Enter with no
 * suggestion sends the typed text (it scores only if it is exactly one player's name).
 */
export function NameInput({
  disabled,
  onShoot,
  onPass,
  autoFocus = true,
}: {
  disabled: boolean;
  onShoot: (pick: { pid: string | null; text: string; label: string }) => void;
  onPass: () => void;
  autoFocus?: boolean;
}) {
  const index = useNameIndex();
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results: IndexEntry[] = useMemo(() => (index ? search(index, text, 6) : []), [index, text]);
  useEffect(() => setActive(0), [text]);
  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, disabled]);

  const shoot = (e?: IndexEntry) => {
    if (disabled) return;
    const pick = e ?? results[active];
    if (pick) onShoot({ pid: pick.i, text: pick.n, label: pick.n });
    else if (text.trim()) onShoot({ pid: null, text: text.trim(), label: text.trim() });
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Name a player"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="go"
            disabled={disabled}
            value={text}
            placeholder={index ? "Start typing a player…" : "Loading every NBA player…"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                shoot();
              } else if (e.key === "Escape") {
                setText("");
              }
            }}
            className="h-14 w-full rounded-[18px] border-[2.5px] border-ink bg-white px-4 text-lg font-bold shadow-[var(--shadow-pop-sm)] outline-none placeholder:font-semibold placeholder:text-ink-soft/70 focus:ring-4 focus:ring-sky disabled:opacity-60"
          />
        </div>
        <button type="button" className="btn btn-coral h-14 shrink-0 px-5 text-lg" disabled={disabled || (!results.length && !text.trim())} onClick={() => shoot()}>
          Shoot
        </button>
      </div>
      {results.length > 0 && !disabled && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching players"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-[18px] border-[2.5px] border-ink bg-white shadow-[var(--shadow-pop)]"
        >
          {results.map((r, i) => (
            <li
              key={r.i}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => shoot(r)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 ${i === active ? "bg-butter-soft" : ""} ${i ? "border-t border-wash" : ""}`}
            >
              <span className="min-w-0 truncate font-bold">{r.n.replace(/\s*\(.*\)$/, "")}</span>
              <span className="tnum shrink-0 text-xs font-semibold text-ink-soft">{r.y}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-ink-soft">
        <span className="hidden sm:inline">↑ ↓ to choose, Enter to shoot</span>
        <button type="button" className="ml-auto rounded-full px-2 py-1 underline decoration-2 underline-offset-2 hover:text-ink" disabled={disabled} onClick={onPass}>
          Pass on this one
        </button>
      </div>
    </div>
  );
}
