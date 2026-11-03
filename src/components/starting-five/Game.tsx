"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SFResult, StartResponse, StepResponse, WheelName } from "@/games/starting-five/api-types";
import type { Clue } from "@/games/starting-five/engine/archetype";
import { gradeLineup } from "@/games/starting-five/engine/grades";
import type { Action, RunView } from "@/games/starting-five/engine/run";
import { SLOTS, type SFPlayer, type Slot } from "@/games/starting-five/types";
import { puzzleDate } from "@/lib/day";
import { hashSeed, rng } from "@/lib/rng";
import { deviceId } from "@/lib/client/device";
import { load, remove, save } from "@/lib/client/storage";
import { GradeBars } from "./GradeBars";
import { HowToPlay } from "./HowToPlay";
import { LineupBoard } from "./LineupBoard";
import { PlayerCard } from "./PlayerCard";
import { ResultView } from "./ResultView";
import { Wheel } from "./Wheel";

type Saved = {
  date: string;
  puzzleNumber: number;
  theme: string;
  clues: Record<Slot, Clue>;
  token: string;
  view: RunView;
  current: SFPlayer | null;
  lineup: Partial<Record<Slot, SFPlayer>>;
  /** Has the current player been revealed on the wheel? */
  revealed: boolean;
  result?: SFResult;
};

type Phase = "loading" | "idle" | "spinning" | "revealed" | "complete" | "simulating" | "result" | "error";

const keyFor = (date: string) => `tripdub:sf:daily:${date}`;

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data as T;
}

/** 16 wheel segments: the real result plus decoys, mixed across tiers so the wheel feels alive. */
function buildSegments(names: WheelName[], target: SFPlayer, seed: number) {
  const r = rng(seed);
  const byTier: Record<string, WheelName[]> = {};
  for (const n of names) if (n.n !== target.name) (byTier[n.t] ??= []).push(n);
  const mix: WheelName["t"][] = ["legend", "legend", "legend", "allstar", "allstar", "allstar", "allstar", "allstar",
    "starter", "starter", "starter", "starter", "role", "role", "role"];
  const used = new Set<string>();
  const decoys = mix.map((t) => {
    const list = byTier[t]?.length ? byTier[t] : names;
    for (let tries = 0; tries < 20; tries++) {
      const pick = list[Math.floor(r() * list.length)];
      if (!used.has(pick.n)) {
        used.add(pick.n);
        return pick;
      }
    }
    return list[0];
  });
  for (let i = decoys.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [decoys[i], decoys[j]] = [decoys[j], decoys[i]];
  }
  const targetIndex = Math.floor(r() * 16);
  const segments = [...decoys.slice(0, targetIndex), { n: target.name, t: target.tier }, ...decoys.slice(targetIndex)];
  return { segments, targetIndex };
}

export function Game() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [s, setS] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<WheelName[]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [preview, setPreview] = useState<Slot | null>(null);
  const [sound, setSound] = useState(false);
  const [animateResult, setAnimateResult] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; over: Slot | null } | null>(null);
  const [howTo, setHowTo] = useState(false);

  const persist = useCallback((next: Saved) => {
    setS(next);
    save(keyFor(next.date), next);
  }, []);

  const begin = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const st = await api<StartResponse>("/api/sf/daily/start", { device: deviceId() });
      const fresh: Saved = {
        date: st.date,
        puzzleNumber: st.puzzleNumber,
        theme: st.theme,
        clues: st.clues,
        token: st.token,
        view: st.view,
        current: st.current,
        lineup: {},
        revealed: false,
      };
      persist(fresh);
      setPhase("idle");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [persist]);

  // Resume today's run from this device, or start one.
  useEffect(() => {
    setSound(load<boolean>("tripdub:sound") ?? false);
    if (!load<boolean>("tripdub:sf:seen-how-to")) {
      setHowTo(true);
      save("tripdub:sf:seen-how-to", true);
    }
    fetch("/api/sf/names")
      .then((r) => r.json())
      .then((n: WheelName[]) => setNames(n))
      .catch(() => setNames([]));
    const saved = load<Saved>(keyFor(puzzleDate()));
    if (saved?.token) {
      setS(saved);
      setPhase(saved.result ? "result" : saved.view.done ? "complete" : saved.revealed ? "revealed" : "idle");
    } else {
      void begin();
    }
  }, [begin]);

  const wheel = useMemo(() => {
    if (!s?.current) return null;
    const pool = names.length ? names : [{ n: s.current.name, t: s.current.tier }];
    return buildSegments(pool, s.current, hashSeed(s.current.id, s.view.index, s.date));
  }, [names, s?.current, s?.view.index, s?.date]);

  const spin = () => {
    if (!s?.current || phase !== "idle") return;
    setPreview(null);
    setPhase("spinning");
    setSpinKey((k) => k + 1);
  };

  const onSpinDone = useCallback(() => {
    setS((prev) => {
      if (!prev) return prev;
      const next = { ...prev, revealed: true };
      save(keyFor(next.date), next);
      return next;
    });
    setPhase("revealed");
  }, []);

  const act = async (action: Action) => {
    if (!s || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<StepResponse>("/api/sf/daily/step", { token: s.token, action });
      const next: Saved = { ...s, token: r.token, view: r.view, current: r.current, lineup: r.lineup, revealed: false };
      persist(next);
      setPreview(null);
      if (action.t === "respin") {
        setPhase("spinning");
        setSpinKey((k) => k + 1);
      } else {
        setPhase(r.view.done ? "complete" : "idle");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const lock = (slot: Slot) => act({ t: "place", slot });

  const simulate = async () => {
    if (!s || busy) return;
    setBusy(true);
    setError(null);
    setPhase("simulating");
    try {
      const result = await api<SFResult>("/api/sf/daily/finish", { token: s.token });
      persist({ ...s, result });
      setAnimateResult(true);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
      setPhase("complete");
    } finally {
      setBusy(false);
    }
  };

  // Drag the revealed card onto a slot (mouse or touch).
  const dragStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const onCardPointerDown = (e: React.PointerEvent) => {
    if (phase !== "revealed" || busy) return;
    if (e.pointerType !== "mouse" && !(e.target as HTMLElement).closest("[data-grip]")) return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  useEffect(() => {
    if (phase !== "revealed") return;
    const slotAt = (x: number, y: number) =>
      ((document.elementFromPoint(x, y)?.closest("[data-slot]") as HTMLElement | null)?.dataset.slot as Slot | undefined) ?? null;
    const move = (e: PointerEvent) => {
      const st = dragStart.current;
      if (!st || e.pointerId !== st.id) return;
      if (!drag && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 8) return;
      e.preventDefault();
      setDrag({ x: e.clientX, y: e.clientY, over: slotAt(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      const st = dragStart.current;
      dragStart.current = null;
      if (!st || e.pointerId !== st.id) return;
      setDrag((d) => {
        if (d) {
          const over = slotAt(e.clientX, e.clientY);
          if (over) void lock(over);
        }
        return null;
      });
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, drag, s?.token]);

  const toggleSound = () => {
    setSound((v) => {
      save("tripdub:sound", !v);
      return !v;
    });
  };

  if (phase === "loading" && !s) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <p className="animate-pulse text-lg font-semibold text-ink-soft">Setting up tonight’s game…</p>
      </div>
    );
  }
  if (phase === "error" && !s) {
    return (
      <div className="mx-auto grid max-w-md gap-4 py-20 text-center">
        <p className="text-lg font-semibold">{error}</p>
        <button className="btn btn-coral mx-auto" onClick={() => void begin()}>
          Try again
        </button>
      </div>
    );
  }
  if (!s) return null;

  const placed = SLOTS.filter((k) => s.lineup[k]).length;
  const pending = phase === "revealed" ? s.current : null;
  const gradePlayers = [...(Object.values(s.lineup) as SFPlayer[]), ...(pending && preview ? [pending] : [])];
  const liveGrades = gradePlayers.length ? gradeLineup(gradePlayers) : null;
  const spinNumber = Math.min(5, placed + 1);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <span className="varsity rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">#{s.puzzleNumber}</span>
            {new Date(`${s.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Starting Five</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-white px-3 py-2 text-sm" onClick={toggleSound} aria-pressed={sound}>
            {sound ? "Sound on" : "Sound off"}
          </button>
          <button type="button" className="btn btn-white px-3 py-2 text-sm" onClick={() => setHowTo(true)}>
            How to play
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-[2.5px] border-ink bg-coral-soft px-4 py-3">
          <span className="font-semibold">{error}</span>
          {/expired/i.test(error) && (
            <button
              className="btn btn-white px-3 py-1 text-sm"
              onClick={() => {
                remove(keyFor(s.date));
                setS(null);
                void begin();
              }}
            >
              Reload puzzle
            </button>
          )}
        </div>
      )}

      {phase === "result" && s.result ? (
        <div className="mt-6">
          <ResultView result={s.result} animate={animateResult} />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          {/* Wheel stage */}
          <section className="pop relative overflow-hidden rounded-[32px] bg-sky p-4 sm:p-6" aria-live="polite">
            <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
              <div className={`mx-auto w-full max-w-[460px] transition-opacity duration-300 ${pending ? "opacity-25" : ""}`}>
                {wheel ? (
                  <Wheel
                    segments={wheel.segments}
                    targetIndex={wheel.targetIndex}
                    spinKey={spinKey}
                    sound={sound}
                    onDone={onSpinDone}
                    landed={phase === "revealed"}
                  />
                ) : (
                  <div className="aspect-square" />
                )}
              </div>
              <AnimatePresence>
                {pending && (
                  <motion.div
                    key={pending.id}
                    initial={{ opacity: 0, scale: 0.7, rotate: -4, y: 30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -20, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.45 }}
                    className="z-10 mx-auto w-full max-w-[420px] self-center"
                  >
                    <PlayerCard
                      player={pending}
                      onPointerDown={onCardPointerDown}
                      className={`cursor-grab touch-pan-y active:cursor-grabbing ${drag ? "opacity-60" : ""}`}
                      footer={
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink-soft">Pick a slot, or drag his photo there</p>
                          <button
                            type="button"
                            className="btn btn-white px-3 py-1.5 text-sm"
                            disabled={busy || s.view.respinsLeft < 1}
                            onClick={() => void act({ t: "respin" })}
                          >
                            {s.view.respinsLeft > 0 ? "Re-spin (1 left)" : "No re-spins left"}
                          </button>
                        </div>
                      }
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!pending && (
              <div className="mt-4 flex flex-col items-center gap-2 text-center">
                {phase === "complete" || phase === "simulating" ? (
                  <>
                    <p className="font-semibold">Your five is locked. Time to play.</p>
                    <button type="button" className="btn btn-coral px-8 py-3 text-lg" onClick={simulate} disabled={busy}>
                      {phase === "simulating" ? "Playing the game…" : "Play the Mystery Five"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">
                      Spin {spinNumber} of 5
                      <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-xs">
                        {s.view.respinsLeft} re-spin{s.view.respinsLeft === 1 ? "" : "s"} left
                      </span>
                    </p>
                    <button
                      type="button"
                      className="btn btn-coral px-10 py-3 text-lg"
                      onClick={spin}
                      disabled={phase !== "idle" || busy || !wheel}
                    >
                      {phase === "spinning" ? "Spinning…" : "Spin"}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Matchup board */}
          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
            <div className="pop rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-extrabold">Your five vs the Mystery Five</h2>
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">{s.theme}</span>
              </div>
              <p className="mb-4 text-sm text-ink-soft">
                Each slot guards and attacks the Mystery Five player in the same slot. Their clues show the era and how they play.
              </p>
              <LineupBoard
                clues={s.clues}
                lineup={s.lineup}
                pending={pending}
                preview={preview}
                busy={busy}
                dragOver={drag?.over ?? null}
                onPreview={setPreview}
                onLock={(slot) => void lock(slot)}
              />
            </div>
            <div className="pop rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
              <h2 className="mb-1 text-lg font-extrabold">Lineup grades</h2>
              <p className="mb-4 text-sm text-ink-soft">
                {liveGrades
                  ? preview
                    ? `With ${pending?.name} at ${preview}.`
                    : "Updates as you fill your five."
                  : "Place your first player to see how the lineup grades out."}
              </p>
              <GradeBars
                grades={liveGrades ?? { sco: 0, def: 0, reb: 0, spc: 0, ply: 0, overall: 0 }}
                dim={!liveGrades}
              />
            </div>
          </section>
        </div>
      )}

      {drag && pending && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-ink bg-white px-4 py-2 font-bold shadow-[var(--shadow-pop)]"
          style={{ left: drag.x, top: drag.y }}
        >
          {pending.name}
          {drag.over && <span className="ml-1.5 text-coral-deep">to {drag.over}</span>}
        </div>
      )}

      <HowToPlay open={howTo} onClose={() => setHowTo(false)} />
    </div>
  );
}
