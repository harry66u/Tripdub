"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/common/Countdown";
import { ModeTabs } from "@/components/common/ModeTabs";
import { ShareButton } from "@/components/common/ShareButton";
import { topPercent } from "@/games/starting-five/engine/format";
import { zoneFor } from "@/games/deep-cut/engine/scoring";
import { tierEmoji } from "@/games/deep-cut/engine/share";
import { MAX_SCORE, TIER_BLURB, TIER_LABEL, TIER_POINTS, TIERS, type ServedPrompt, type Tier } from "@/games/deep-cut/types";
import { addDays, LAUNCH_DATE, puzzleDate, puzzleNumber } from "@/lib/day";
import { deviceId } from "@/lib/client/device";
import { markDailyDone } from "@/lib/client/progress";
import { load, remove, save } from "@/lib/client/storage";
import { CourtStage, type Landing } from "./CourtStage";
import { GuessInput, type GuessInputHandle } from "./GuessInput";
import { RangeMeter } from "./RangeMeter";
import { TIER_CHIP, TIER_PANEL } from "./tiers";

type Mode = "daily" | "unlimited" | "archive";
const MODES = [
  { id: "daily", label: "Daily" },
  { id: "unlimited", label: "Unlimited" },
  { id: "archive", label: "Archive" },
] as const;

type Result = { id: string; text: string; answer: string | null; tier: Tier | null; pts: number; count: number; rare: { n: string; tier: Tier }[] };
type Done = { score: number; feet: number; results: Result[]; percentile: number | null; total: number | null; share: string };
type Reveal = {
  status: "scored";
  valid: boolean;
  timedOut: boolean;
  passed: boolean;
  outOfTries: boolean;
  tier: Tier | null;
  points: number;
  feet: number;
  name: string | null;
  corrected: boolean;
  count: number;
  score: number;
  range: number;
  index: number;
  total: number;
  token: string;
  done?: Done;
};
type Rejected = { status: "rejected"; reason: "ambiguous" | "nope"; tries: number; triesLeft: number; leftMs: number; token: string };
type HistoryItem = { prompt: ServedPrompt; reveal: Omit<Reveal, "token" | "done"> };
type Saved = {
  v: 2;
  mode: Mode;
  date: string;
  day: string;
  puzzleNumber: number | null;
  token: string;
  index: number;
  total: number;
  limitMs: number;
  leadMs: number;
  prompt: ServedPrompt | null;
  /** Client clock when the current prompt appeared; the shot clock starts leadMs later */
  shownAt: number | null;
  reveal: Reveal | null;
  history: HistoryItem[];
  done?: Done;
  finished?: boolean;
};

const keyFor = (m: Mode, day?: string) => (m === "archive" ? `tripdub:deepcut:v2:archive:${day}` : `tripdub:deepcut:v2:${m}`);

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data as T;
}

function resumable(s: Saved | null): s is Saved {
  if (!s || s.v !== 2 || !s.token) return false;
  const today = puzzleDate();
  return s.date === today || (s.date === addDays(today, -1) && !s.done);
}

function archiveDays(today = puzzleDate()): string[] {
  const out: string[] = [];
  for (let d = addDays(today, -1); d >= LAUNCH_DATE; d = addDays(d, -1)) out.push(d);
  return out;
}

const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const shortName = (n: string) => n.replace(/\s*\(.*\)$/, "");

function TierChip({ tier }: { tier: Tier | null }) {
  return (
    <span className={`varsity inline-flex items-center rounded-full border-2 border-ink px-2.5 py-0.5 text-xs whitespace-nowrap ${TIER_CHIP[tier ?? "miss"]}`}>
      {tier ? TIER_LABEL[tier] : "No good"}
    </span>
  );
}

function TierLadder() {
  return (
    <ol className="grid gap-1.5 sm:grid-cols-2">
      {TIERS.map((t) => (
        <li key={t} className={`flex items-center justify-between gap-2 rounded-xl border-2 border-ink px-3 py-1.5 ${TIER_PANEL[t]}`}>
          <span className="varsity text-xs whitespace-nowrap sm:text-sm">{TIER_LABEL[t]}</span>
          <span className="varsity tnum text-sm">{TIER_POINTS[t]}</span>
        </li>
      ))}
    </ol>
  );
}

function Flames() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute bottom-0 h-3 w-3 rounded-full"
          style={{ left: `${(i * 41) % 100}%`, background: i % 3 ? "var(--color-coral)" : "var(--color-butter)" }}
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={{ y: -160 - (i % 5) * 30, opacity: 0, scale: 0.3 }}
          transition={{ duration: 1 + (i % 4) * 0.2, delay: (i % 6) * 0.05, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function revealHeadline(r: Reveal) {
  if (r.tier) return { head: TIER_LABEL[r.tier], sub: TIER_BLURB[r.tier] };
  if (r.timedOut) return { head: "Shot clock violation", sub: "Out of time. No points on this one." };
  if (r.outOfTries) return { head: "Out of shots", sub: "That's the limit on misses for one prompt." };
  return { head: "Passed", sub: "No points, on to the next one." };
}

function RevealCard({ r }: { r: Reveal }) {
  const reduce = useReducedMotion();
  const t = r.tier;
  const big = t === "halfcourt" || t === "logo";
  const { head, sub } = revealHeadline(r);
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.85, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: big ? 260 : 420, damping: big ? 14 : 24, delay: reduce ? 0 : 0.35 }}
      className={`relative overflow-hidden rounded-[22px] border-[2.5px] border-ink p-4 shadow-[var(--shadow-pop)] sm:p-5 ${TIER_PANEL[t ?? "miss"]}`}
      aria-live="polite"
    >
      {t === "halfcourt" && !reduce && <Flames />}
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          {r.name && t && (
            <p className="truncate text-sm font-bold opacity-85">
              {shortName(r.name)}
              {r.corrected && <span className="ml-1.5 text-xs font-semibold opacity-80">(spelling fixed)</span>}
            </p>
          )}
          <p className={`varsity leading-none ${big ? "text-[2rem] sm:text-5xl" : "text-[1.6rem] sm:text-4xl"}`}>{head}</p>
        </div>
        <div className="text-right">
          <p className="varsity tnum text-[2rem] leading-none sm:text-5xl">+{r.points}</p>
          <p className="mt-1 text-xs font-bold whitespace-nowrap opacity-80 sm:text-sm">+{r.feet} ft of range</p>
        </div>
        <p className="col-span-2 text-sm font-semibold opacity-85 sm:text-base">{sub}</p>
      </div>
    </motion.div>
  );
}

function HudPanel({ label, value, unit, align = "left" }: { label: string; value: string | number; unit?: string; align?: "left" | "right" }) {
  return (
    <div className={`rounded-2xl border-[2.5px] border-ink bg-white px-3 py-1.5 shadow-[var(--shadow-pop-sm)] sm:px-4 sm:py-2 ${align === "right" ? "text-right" : ""}`}>
      <p className="varsity text-[10px] tracking-[0.2em] text-ink-soft sm:text-xs">{label}</p>
      <p className="varsity tnum text-2xl leading-none sm:text-3xl">
        {value}
        {unit && <span className="ml-1 text-sm sm:text-base">{unit}</span>}
      </p>
    </div>
  );
}

export function DeepCutGame() {
  const [mode, setMode] = useState<Mode>("daily");
  const [archiveDay, setArchiveDay] = useState<string | null>(null);
  const [s, setS] = useState<Saved | null>(null);
  const [intro, setIntro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [shot, setShot] = useState<{ tier: Tier | null; id: number } | null>(null);
  const busyRef = useRef(false);
  const guessRef = useRef<GuessInputHandle>(null);

  const persist = useCallback((next: Saved) => {
    setS(next);
    save(keyFor(next.mode, next.day), next);
  }, []);

  const begin = useCallback(
    async (m: Mode, day?: string) => {
      setS(null);
      setIntro(false);
      setError(null);
      setShot(null);
      try {
        const r = await api<{ mode: Mode; date: string; day: string; puzzleNumber: number | null; token: string; index: number; total: number; limitMs: number; leadMs: number; prompt: ServedPrompt }>(
          "/api/deep-cut/start",
          { device: deviceId(), mode: m, day },
        );
        persist({ v: 2, mode: r.mode, date: r.date, day: r.day, puzzleNumber: r.puzzleNumber, token: r.token, index: r.index, total: r.total, limitMs: r.limitMs, leadMs: r.leadMs, prompt: r.prompt, shownAt: Date.now(), reveal: null, history: [] });
      } catch (e) {
        setError((e as Error).message);
        setIntro(true);
      }
    },
    [persist],
  );

  const open = useCallback((m: Mode, day?: string | null) => {
    setMode(m);
    setError(null);
    setShot(null);
    if (m === "archive" && !day) {
      setArchiveDay(null);
      setS(null);
      setIntro(false);
      return;
    }
    if (m === "archive") setArchiveDay(day!);
    const saved = load<Saved>(keyFor(m, day ?? undefined));
    if (resumable(saved)) {
      setS(saved);
      setIntro(false);
    } else {
      setS(null);
      setIntro(true);
    }
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("mode");
    const day = q.get("day");
    if (m === "unlimited") open("unlimited");
    else if (m === "archive" || day) open("archive", day && archiveDays().includes(day) ? day : null);
    else open("daily");
  }, [open]);

  const shoot = useCallback(
    async (body: { text?: string; pass?: boolean; buzzer?: boolean }) => {
      if (!s?.prompt || s.reveal || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const r = await api<Reveal | Rejected>("/api/deep-cut/answer", { token: s.token, ...body });
        if (r.status === "rejected") {
          persist({ ...s, token: r.token });
          guessRef.current?.reject(r.reason === "ambiguous" ? "Which one? Add a first name." : "No good. Shoot again.", body.text ?? "");
          return;
        }
        const { token, done, ...rest } = r;
        persist({ ...s, token, reveal: r, history: [...s.history, { prompt: s.prompt, reveal: rest }], done });
        setShot({ tier: r.tier, id: Date.now() });
        if (done && s.mode === "daily") markDailyDone("deep", s.date, `${done.score} pts, ${done.feet} ft`, done.share);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [s, persist],
  );

  const nextPrompt = async () => {
    if (!s || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await api<{ index: number; total: number; limitMs: number; leadMs: number; prompt: ServedPrompt; token: string }>("/api/deep-cut/next", { token: s.token });
      guessRef.current?.clear();
      persist({ ...s, token: r.token, index: r.index, prompt: r.prompt, limitMs: r.limitMs, leadMs: r.leadMs, shownAt: Date.now(), reveal: null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Read-in, then the shot clock; at zero the prompt ends with no points.
  const active = !!s?.prompt && !s.reveal && !s.done;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [active]);
  const clockStart = (s?.shownAt ?? 0) + (s?.leadMs ?? 0);
  const leadLeft = active ? Math.max(0, clockStart - now) : 0;
  const live = active && leadLeft <= 0;
  const left = active ? Math.max(0, s!.limitMs - Math.max(0, now - clockStart)) : 0;
  useEffect(() => {
    if (live && left <= 0 && !busyRef.current) void shoot({ buzzer: true });
  }, [live, left, shoot]);

  const score = s?.reveal?.score ?? s?.history.at(-1)?.reveal.score ?? 0;
  const feet = Math.round(score) / 10;
  const landings: Landing[] = [];
  {
    let acc = 0;
    for (const h of s?.history ?? []) {
      acc += h.reveal.points;
      // Only made shots move you; a pass or a miss stays where you were
      if (h.reveal.tier && h.reveal.name) landings.push({ feet: acc / 10, label: shortName(h.reveal.name), tier: h.reveal.tier });
    }
  }

  const heading = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
          {mode === "unlimited" ? (
            <span>Unlimited: random prompts, just for fun</span>
          ) : mode === "archive" && !archiveDay ? (
            <span>Archive: replay any past day</span>
          ) : (
            <>
              <span className="varsity rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">#{puzzleNumber(mode === "archive" ? archiveDay! : (s?.day ?? puzzleDate()))}</span>
              {longDate(mode === "archive" ? archiveDay! : (s?.day ?? puzzleDate()))}
              {mode === "archive" && <span className="rounded-full bg-butter-soft px-2 py-0.5 text-xs font-bold text-ink">Archive, unscored</span>}
            </>
          )}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Deep Cut</h1>
      </div>
      <ModeTabs<Mode> mode={mode} modes={MODES} onChange={(m) => open(m)} />
    </div>
  );
  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-6 sm:px-6 sm:pt-8">
      {heading}
      {children}
    </div>
  );

  // ----- Archive picker -----
  if (mode === "archive" && !archiveDay) {
    const days = archiveDays();
    return shell(
      <section className="mt-6">
        {days.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {days.map((d) => {
              const saved = load<Saved>(keyFor("archive", d));
              return (
                <li key={d}>
                  <button type="button" onClick={() => open("archive", d)} className="pop-sm flex w-full items-center justify-between gap-3 rounded-[18px] bg-white px-4 py-3 text-left hover:-translate-y-0.5">
                    <span>
                      <span className="varsity mr-2 text-sm">#{puzzleNumber(d)}</span>
                      <span className="font-bold">{longDate(d)}</span>
                    </span>
                    {saved?.done ? <span className="varsity text-sm">{saved.done.score}</span> : <span className="text-sm font-semibold text-ink-soft">Play</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="pop rounded-[var(--radius-card)] bg-white p-6">
            <p className="text-xl font-extrabold">The archive opens tomorrow.</p>
            <p className="mt-1 text-ink-soft">Every daily Deep Cut joins the archive the day after it runs, so you can replay any set you missed.</p>
            <button type="button" className="btn btn-coral mt-4" onClick={() => open("daily")}>
              Play today’s Deep Cut
            </button>
          </div>
        )}
      </section>,
    );
  }

  // ----- Intro -----
  if ((intro && !s) || (!s && error)) {
    return shell(
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="pop rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
          <p className="text-sm font-bold text-coral-deep">{mode === "daily" ? "Today’s seven prompts" : mode === "archive" ? "A past day’s seven prompts" : "Seven random prompts"}</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Rarer answers shoot deeper.</h2>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            Each prompt has many right answers. Type one player before the 25-second shot clock runs out. Wrong answers bounce off, so shoot again. The answer everyone says is a layup; the one nobody thinks of is a shot from way downtown.
          </p>
          <div className="mt-5">
            <TierLadder />
          </div>
          <p className="mt-4 text-sm font-semibold text-ink-soft">Every 10 points moves you a foot farther from the rim. A perfect day is 700: their free-throw line.</p>
          {error && <p className="mt-4 font-semibold text-coral-deep">{error}</p>}
          <button type="button" className="btn btn-coral mt-5 px-6 text-lg" onClick={() => void begin(mode, archiveDay ?? undefined)}>
            {mode === "daily" ? `Start Deep Cut #${puzzleNumber(puzzleDate())}` : mode === "archive" ? `Start #${puzzleNumber(archiveDay!)}` : "Start"}
          </button>
        </div>
        <div className="pop relative hidden h-[480px] overflow-hidden rounded-[var(--radius-card)] lg:block">
          <CourtStage feet={0} landings={[]} anchor={0.5} />
        </div>
      </section>,
    );
  }

  if (!s) {
    return shell(
      <div className="grid min-h-[40vh] place-items-center text-center">
        <p className="animate-pulse text-lg font-semibold text-ink-soft">Walking out to the court…</p>
      </div>,
    );
  }

  // ----- Results -----
  if (s.done && s.finished) {
    const d = s.done;
    const zone = zoneFor(d.feet);
    return shell(
      <>
        <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[var(--radius-card)] border-[2.5px] border-ink bg-ink p-6 text-white shadow-[var(--shadow-pop-lg)] sm:p-8">
            <p className="text-sm font-semibold text-sky">Final range</p>
            <p className="varsity tnum text-6xl leading-none sm:text-7xl">
              {d.feet}
              <span className="ml-2 text-3xl">ft</span>
            </p>
            <p className="mt-2 text-lg font-bold text-butter">{zone.label}</p>
            <p className="mt-4 text-3xl tracking-widest" aria-label="Your shot ranges">
              {d.results.map((r) => tierEmoji(r.tier)).join("")}
            </p>
            <p className="mt-3 font-semibold text-sky">
              <span className="varsity text-white">{d.score}</span> of {MAX_SCORE} points
              {d.percentile != null && d.total != null && (d.total < 5 ? ` · One of the first ${d.total} to finish today` : ` · Top ${topPercent(d.percentile)}% of ${d.total.toLocaleString()} today`)}
            </p>
          </div>
          <div className="pop overflow-hidden rounded-[var(--radius-card)] bg-sky p-2">
            <RangeMeter feet={d.feet} orientation="horizontal" className="h-auto w-full" />
          </div>
        </section>

        <ol className="mt-6 grid gap-3 lg:grid-cols-2">
          {d.results.map((r, i) => (
            <li key={r.id} className="pop-sm rounded-[18px] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink-soft">Prompt {i + 1}</p>
                <span className="varsity tnum text-lg">{r.pts ? `+${r.pts}` : "0"}</span>
              </div>
              <p className="mt-0.5 font-extrabold">{r.text}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <TierChip tier={r.tier} />
                <span className="font-semibold">{r.answer ? shortName(r.answer) : s.history[i]?.reveal.timedOut ? "Out of time" : "No answer"}</span>
              </p>
              {r.rare.length > 0 && (
                <p className="mt-2 text-sm text-ink-soft">
                  <span className="font-bold text-ink">Deep cuts you could’ve had: </span>
                  {r.rare.map((x, k) => (
                    <span key={x.n}>
                      {k > 0 && ", "}
                      {shortName(x.n)} <span className="text-xs font-bold">({TIER_LABEL[x.tier]})</span>
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-1 text-xs font-semibold text-ink-soft">{r.count.toLocaleString()} valid answers</p>
            </li>
          ))}
        </ol>

        <div className="pop mt-6 flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-sky p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-extrabold">Share your range</p>
            <p className="text-sm">Shot ranges only. No answers, no spoilers.</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <ShareButton text={d.share} />
              <button
                type="button"
                className="btn btn-white"
                onClick={() => {
                  remove(keyFor("unlimited"));
                  setMode("unlimited");
                  void begin("unlimited");
                }}
              >
                {s.mode === "unlimited" ? "Play again" : "Play unlimited"}
              </button>
            </div>
            {s.mode === "daily" && <Countdown className="text-sm font-semibold" />}
          </div>
        </div>
      </>,
    );
  }

  // ----- Playing: on the court -----
  const p = s.prompt!;
  const r = s.reveal;
  const seconds = Math.ceil((live ? left : s.limitMs) / 1000);
  return (
    <div className="relative h-[calc(100svh-var(--header-h))] min-h-[520px] w-full">
      <CourtStage feet={feet} shot={shot} landings={landings} anchor={0.8}>
        {/* HUD */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
          <HudPanel label="RANGE" value={feet} unit="FT" />
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="flex gap-1" aria-label={`Prompt ${s.index + 1} of ${s.total}`}>
              {Array.from({ length: s.total }, (_, i) => {
                const h = s.history[i];
                return (
                  <span
                    key={i}
                    className={`h-4 w-4 rounded-[5px] border-2 border-ink sm:h-5 sm:w-5 ${h ? TIER_CHIP[h.reveal.tier ?? "miss"].split(" ")[0] : i === s.index ? "bg-butter" : "bg-white/40"}`}
                  />
                );
              })}
            </div>
            <p className="varsity text-[10px] tracking-[0.2em] text-white sm:text-xs">
              PROMPT {s.index + 1} OF {s.total}
            </p>
          </div>
          <HudPanel label="SCORE" value={score} align="right" />
        </div>

        {/* the prompt and your shot */}
        <div className="absolute inset-x-0 top-[5.25rem] z-10 mx-auto grid w-[min(760px,calc(100%-1.5rem))] grid-cols-[minmax(0,1fr)] gap-3 sm:top-24">
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border-[2.5px] border-ink bg-coral-soft px-4 py-2.5">
              <span className="text-sm font-semibold">{error}</span>
              {/expired/i.test(error) && (
                <button className="btn btn-white px-3 py-1 text-sm" onClick={() => { remove(keyFor(s.mode, s.day)); void begin(s.mode, s.mode === "archive" ? s.day : undefined); }}>
                  Reload
                </button>
              )}
            </div>
          )}
          <motion.section key={p.id} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="pop rounded-[var(--radius-card)] bg-white p-4 sm:p-6">
            <p className="varsity flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.15em] text-coral-deep sm:text-xs">
              <span>PROMPT {s.index + 1} OF {s.total}</span>
              <span className="text-ink-soft">{p.kind === "general" ? "GENERAL" : "SPECIFIC"}</span>
              <span className="text-ink-soft">{p.count.toLocaleString()} VALID ANSWERS</span>
            </p>
            <h2 className={`mt-2 leading-[1.1] font-extrabold tracking-tight text-balance ${r ? "text-xl sm:text-2xl" : "text-[1.6rem] sm:text-[2.3rem]"}`}>{p.text}</h2>
            {p.note && !r && <p className="mt-1.5 text-sm font-medium text-ink-soft">{p.note}</p>}
            {!r && <p className="mt-2 text-xs font-bold text-ink-soft">▼ The rarer the answer, the deeper the shot ▼</p>}
          </motion.section>

          <AnimatePresence mode="wait" initial={false}>
            {r ? (
              <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-[minmax(0,1fr)] gap-3">
                <RevealCard r={r} />
                <button
                  type="button"
                  className="btn btn-coral justify-self-start px-6"
                  disabled={busy}
                  autoFocus
                  onClick={() => (r.index + 1 >= r.total ? persist({ ...s, finished: true }) : void nextPrompt())}
                >
                  {r.index + 1 >= r.total ? "See your results" : "Next prompt"}
                </button>
              </motion.div>
            ) : (
              <motion.div key="shoot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[22px] bg-ink/55 p-2.5 backdrop-blur-sm sm:p-3">
                <GuessInput ref={guessRef} disabled={busy} live={live} seconds={seconds} onShoot={(text) => void shoot({ text })} onPass={() => void shoot({ pass: true })} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* read-in before the shot clock */}
        <AnimatePresence>
          {active && leadLeft > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-6 z-10 mx-auto w-fit rounded-full border-[2.5px] border-ink bg-white px-5 py-2 shadow-[var(--shadow-pop-sm)]"
            >
              <span className="varsity text-sm tracking-[0.12em]">
                Bringing it up the floor · shot clock in <span className="text-coral-deep">{Math.ceil(leadLeft / 1000)}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </CourtStage>
    </div>
  );
}
