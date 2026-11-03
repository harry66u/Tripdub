"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SFResult, StartResponse, StepResponse, WheelName } from "@/games/starting-five/api-types";
import type { Clue } from "@/games/starting-five/engine/archetype";
import { gradeLineup } from "@/games/starting-five/engine/grades";
import type { Action, RunView } from "@/games/starting-five/engine/run";
import { SLOTS, type Lineup, type SFPlayer, type Slot } from "@/games/starting-five/types";
import { addDays, puzzleDate } from "@/lib/day";
import { hashSeed, rng, shuffle } from "@/lib/rng";
import { deviceId } from "@/lib/client/device";
import { load, remove, save } from "@/lib/client/storage";
import { FaceRoulette } from "./FaceRoulette";
import { GradeBars } from "./GradeBars";
import { HowToPlay } from "./HowToPlay";
import { LineupBoard } from "./LineupBoard";
import { PlayerCard } from "./PlayerCard";
import { ResultView } from "./ResultView";

type Mode = "daily" | "unlimited";

type Saved = {
  v: 2;
  mode: Mode;
  date: string;
  puzzleNumber: number | null;
  theme: string;
  opponent: Lineup;
  clues: Record<Slot, Clue>;
  token: string;
  view: RunView;
  current: SFPlayer | null;
  lineup: Partial<Record<Slot, SFPlayer>>;
  /** Has the current player been revealed? */
  revealed: boolean;
  result?: SFResult;
};

type Phase = "loading" | "idle" | "spinning" | "revealed" | "complete" | "simulating" | "result" | "error";

const keyFor = (mode: Mode) => `tripdub:sf:v2:${mode}`;

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data as T;
}

/** A saved run worth resuming: today's, or an unfinished one from last night. */
function resumable(saved: Saved | null): saved is Saved {
  if (!saved || saved.v !== 2 || !saved.token) return false;
  const today = puzzleDate();
  if (saved.date === today) return true;
  return saved.date === addDays(today, -1) && !saved.result;
}

function phaseOf(s: Saved): Phase {
  return s.result ? "result" : s.view.done ? "complete" : s.revealed ? "revealed" : "idle";
}

export function Game() {
  const [mode, setMode] = useState<Mode>("daily");
  const [phase, setPhase] = useState<Phase>("loading");
  const [s, setS] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [faces, setFaces] = useState<WheelName[] | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const [preview, setPreview] = useState<Slot | null>(null);
  const [sound, setSound] = useState(false);
  const [animateResult, setAnimateResult] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; over: Slot | null } | null>(null);
  const [howTo, setHowTo] = useState(false);
  const busyRef = useRef(false);

  const persist = useCallback((next: Saved) => {
    setS(next);
    save(keyFor(next.mode), next);
  }, []);

  const begin = useCallback(
    async (m: Mode) => {
      setPhase("loading");
      setError(null);
      setPreview(null);
      setAnimateResult(false);
      try {
        const st = await api<StartResponse>("/api/sf/daily/start", { device: deviceId(), mode: m });
        persist({
          v: 2,
          mode: st.mode,
          date: st.date,
          puzzleNumber: st.puzzleNumber,
          theme: st.theme,
          opponent: st.opponent,
          clues: st.clues,
          token: st.token,
          view: st.view,
          current: st.current,
          lineup: {},
          revealed: false,
        });
        setPhase("idle");
      } catch (e) {
        setError((e as Error).message);
        setPhase("error");
      }
    },
    [persist],
  );

  const open = useCallback(
    (m: Mode) => {
      setMode(m);
      const saved = load<Saved>(keyFor(m));
      if (resumable(saved)) {
        setS(saved);
        setPreview(null);
        setAnimateResult(false);
        setPhase(phaseOf(saved));
      } else {
        setS(null);
        void begin(m);
      }
    },
    [begin],
  );

  useEffect(() => {
    setSound(load<boolean>("tripdub:sound") ?? false);
    if (!load<boolean>("tripdub:sf:seen-how-to-v2")) {
      setHowTo(true);
      save("tripdub:sf:seen-how-to-v2", true);
    }
    fetch("/api/sf/names")
      .then((r) => r.json())
      .then((n: WheelName[]) => setFaces(Array.isArray(n) ? n : []))
      .catch(() => setFaces([]));
    const initial = new URLSearchParams(window.location.search).get("mode") === "unlimited" ? "unlimited" : "daily";
    open(initial);
  }, [open]);

  const decoys = useMemo(() => {
    if (!faces || !s?.current) return [];
    return shuffle(faces, rng(hashSeed(s.current.id, s.view.index, s.token.length)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faces, s?.current?.id, s?.view.index]);

  const spin = () => {
    if (!s?.current || phase !== "idle" || faces == null) return;
    setPreview(null);
    setPhase("spinning");
    setSpinKey((k) => k + 1);
  };

  const onSpinDone = useCallback(() => {
    setS((prev) => {
      if (!prev) return prev;
      const next = { ...prev, revealed: true };
      save(keyFor(next.mode), next);
      return next;
    });
    setPhase("revealed");
  }, []);

  const act = useCallback(
    async (action: Action) => {
      if (!s || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const r = await api<StepResponse>("/api/sf/daily/step", { token: s.token, action });
        persist({ ...s, token: r.token, view: r.view, current: r.current, lineup: r.lineup, revealed: false });
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
        busyRef.current = false;
        setBusy(false);
      }
    },
    [s, persist],
  );

  const lock = useCallback((slot: Slot) => act({ t: "place", slot }), [act]);

  const simulate = async () => {
    if (!s || busyRef.current) return;
    busyRef.current = true;
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
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Drag the revealed card onto a slot with a mouse. On touch screens, tap a slot instead.
  const dragRef = useRef<{ x: number; y: number; id: number; active: boolean; over: Slot | null } | null>(null);
  const onCardPointerDown = (e: React.PointerEvent) => {
    if (phase !== "revealed" || busy || e.pointerType !== "mouse") return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false, over: null };
  };
  useEffect(() => {
    if (phase !== "revealed") return;
    const slotAt = (x: number, y: number) =>
      ((document.elementFromPoint(x, y)?.closest("[data-slot]") as HTMLElement | null)?.dataset.slot as Slot | undefined) ?? null;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
      d.active = true;
      d.over = slotAt(e.clientX, e.clientY);
      e.preventDefault();
      setDrag({ x: e.clientX, y: e.clientY, over: d.over });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || e.pointerId !== d.id) return;
      setDrag(null);
      if (d.active) {
        const over = slotAt(e.clientX, e.clientY);
        if (over) void lock(over);
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [phase, lock]);

  const toggleSound = () => {
    setSound((v) => {
      save("tripdub:sound", !v);
      return !v;
    });
  };

  const playAgain = () => {
    remove(keyFor("unlimited"));
    setS(null);
    setMode("unlimited");
    void begin("unlimited");
  };

  const tabs = (
    <div role="tablist" aria-label="Game mode" className="inline-flex rounded-full border-[2.5px] border-ink bg-white p-1 shadow-[var(--shadow-pop-sm)]">
      {(["daily", "unlimited"] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          type="button"
          onClick={() => m !== mode && open(m)}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${mode === m ? "bg-ink text-white" : "text-ink hover:bg-wash"}`}
        >
          {m === "daily" ? "Daily" : "Unlimited"}
        </button>
      ))}
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          {s?.mode === "daily" && s.puzzleNumber != null ? (
            <>
              <span className="varsity rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">#{s.puzzleNumber}</span>
              {new Date(`${s.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </>
          ) : (
            <span>New spins and a new opponent every game</span>
          )}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Starting Five</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tabs}
        <button type="button" className="btn btn-white px-3 py-2 text-sm" onClick={toggleSound} aria-pressed={sound}>
          {sound ? "Sound on" : "Sound off"}
        </button>
        <button type="button" className="btn btn-white px-3 py-2 text-sm" onClick={() => setHowTo(true)}>
          How to play
        </button>
      </div>
    </div>
  );

  if (!s) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8">
        {header}
        {phase === "error" ? (
          <div className="mx-auto grid max-w-md gap-4 py-20 text-center">
            <p className="text-lg font-semibold">{error}</p>
            <button className="btn btn-coral mx-auto" onClick={() => void begin(mode)}>
              Try again
            </button>
          </div>
        ) : (
          <div className="grid min-h-[50vh] place-items-center">
            <p className="animate-pulse text-lg font-semibold text-ink-soft">Setting up the game…</p>
          </div>
        )}
        <HowToPlay open={howTo} onClose={() => setHowTo(false)} />
      </div>
    );
  }

  const placed = SLOTS.filter((k) => s.lineup[k]).length;
  const pending = phase === "revealed" ? s.current : null;
  const gradePlayers = [...(Object.values(s.lineup) as SFPlayer[]), ...(pending && preview ? [pending] : [])];
  const liveGrades = gradePlayers.length ? gradeLineup(gradePlayers) : null;
  const spinNumber = Math.min(5, placed + 1);
  const resultActions =
    s.mode === "unlimited" ? (
      <button type="button" className="btn btn-white" onClick={playAgain}>
        Play again
      </button>
    ) : (
      <button type="button" className="btn btn-white" onClick={playAgain}>
        Play unlimited
      </button>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8">
      {header}

      {error && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-[2.5px] border-ink bg-coral-soft px-4 py-3">
          <span className="font-semibold">{error}</span>
          {/expired|updated/i.test(error) && (
            <button
              className="btn btn-white px-3 py-1 text-sm"
              onClick={() => {
                remove(keyFor(s.mode));
                setS(null);
                void begin(s.mode);
              }}
            >
              Reload puzzle
            </button>
          )}
        </div>
      )}

      {s.mode === "daily" && s.date !== puzzleDate() && !s.result && (
        <p className="mt-4 rounded-2xl bg-butter-soft px-4 py-3 text-sm font-semibold">Finish last night’s game before today’s unlocks.</p>
      )}

      {phase === "result" && s.result ? (
        <div className="mt-6">
          <ResultView result={s.result} animate={animateResult} actions={resultActions} />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
          {/* Draw stage */}
          <section className="pop relative min-w-0 overflow-hidden rounded-[32px] bg-sky p-4 sm:p-6">
            <AnimatePresence mode="wait" initial={false}>
              {pending ? (
                <motion.div
                  key={pending.id}
                  initial={{ opacity: 0, scale: 0.85, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -16, transition: { duration: 0.18 } }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="mx-auto w-full max-w-[420px]"
                >
                  <PlayerCard
                    player={pending}
                    onPointerDown={onCardPointerDown}
                    className={`[@media(pointer:fine)]:cursor-grab ${drag ? "opacity-60" : ""}`}
                    footer={
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-soft">
                          <span className="[@media(pointer:fine)]:hidden">Tap a slot to place him</span>
                          <span className="hidden [@media(pointer:fine)]:inline">Pick a slot, or drag him there</span>
                        </p>
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
              ) : (
                <motion.div key="draw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {s.current ? (
                    <FaceRoulette
                      decoys={decoys}
                      target={s.current}
                      spinKey={spinKey}
                      sound={sound}
                      landed={false}
                      onDone={onSpinDone}
                    />
                  ) : (
                    <div className="mx-auto grid h-56 max-w-[440px] place-items-center rounded-[28px] border-[2.5px] border-ink bg-white text-center shadow-[var(--shadow-pop)] sm:h-64">
                      <p className="px-6 text-lg font-extrabold">Your five is locked in.</p>
                    </div>
                  )}
                  <div className="mt-5 flex flex-col items-center gap-2 text-center">
                    {phase === "complete" || phase === "simulating" ? (
                      <button type="button" className="btn btn-coral px-8 py-3 text-lg" onClick={simulate} disabled={busy}>
                        {phase === "simulating" ? "Playing the game…" : `Play the ${s.theme}`}
                      </button>
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
                          disabled={phase !== "idle" || busy || faces == null}
                        >
                          {phase === "spinning" ? "Spinning…" : "Spin"}
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Matchup board */}
          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
            <div className="pop rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-extrabold">Your five vs the {s.theme}</h2>
              </div>
              <p className="mb-4 text-sm text-ink-soft">Each slot guards and attacks the player across from it.</p>
              <LineupBoard
                opponent={s.opponent}
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
              <GradeBars grades={liveGrades ?? { sco: 0, def: 0, reb: 0, spc: 0, ply: 0, overall: 0 }} dim={!liveGrades} />
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
