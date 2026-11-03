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
import { loadNameIndex, NameInput } from "./NameInput";
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
  valid: boolean;
  timedOut: boolean;
  tier: Tier | null;
  points: number;
  feet: number;
  name: string | null;
  count: number;
  score: number;
  range: number;
  index: number;
  total: number;
  token: string;
  done?: Done;
};
type HistoryItem = { prompt: ServedPrompt; said: string | null; passed: boolean; reveal: Omit<Reveal, "token" | "done"> };
type Saved = {
  v: 1;
  mode: Mode;
  date: string;
  day: string;
  puzzleNumber: number | null;
  token: string;
  index: number;
  total: number;
  limitMs: number;
  prompt: ServedPrompt | null;
  shownAt: number | null;
  reveal: Reveal | null;
  history: HistoryItem[];
  said?: { text: string | null; passed: boolean };
  done?: Done;
  finished?: boolean;
};

const keyFor = (m: Mode, day?: string) => (m === "archive" ? `tripdub:deepcut:v1:archive:${day}` : `tripdub:deepcut:v1:${m}`);

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data as T;
}

function resumable(s: Saved | null): s is Saved {
  if (!s || s.v !== 1 || !s.token) return false;
  const today = puzzleDate();
  return s.date === today || (s.date === addDays(today, -1) && !s.done);
}

function archiveDays(today = puzzleDate()): string[] {
  const out: string[] = [];
  for (let d = addDays(today, -1); d >= LAUNCH_DATE; d = addDays(d, -1)) out.push(d);
  return out;
}

const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

function TierChip({ tier, className = "" }: { tier: Tier | null; className?: string }) {
  return (
    <span className={`varsity inline-flex items-center rounded-full border-2 border-ink px-2.5 py-0.5 text-xs whitespace-nowrap ${TIER_CHIP[tier ?? "miss"]} ${className}`}>
      {tier ? TIER_LABEL[tier] : "No good"}
    </span>
  );
}

function TierLadder({ compact }: { compact?: boolean }) {
  return (
    <ol className={`grid gap-1.5 ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
      {TIERS.map((t) => (
        <li key={t} className={`flex items-center justify-between gap-2 rounded-xl border-2 border-ink ${compact ? "px-2.5 py-1" : "px-3 py-1.5"} ${TIER_PANEL[t]}`}>
          <span className={`varsity whitespace-nowrap ${compact ? "text-[11px]" : "text-xs sm:text-sm"}`}>{TIER_LABEL[t]}</span>
          <span className={`varsity tnum ${compact ? "text-xs" : "text-sm"}`}>{TIER_POINTS[t]}</span>
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

function RevealCard({ r, said, passed }: { r: Reveal; said: string | null; passed: boolean }) {
  const reduce = useReducedMotion();
  const t = r.tier;
  const big = t === "halfcourt" || t === "logo";
  const headline = t
    ? TIER_LABEL[t]
    : r.timedOut
      ? "Shot clock violation"
      : passed
        ? "Passed"
        : said
          ? "Airball"
          : "No shot";
  const sub = t
    ? TIER_BLURB[t]
    : r.timedOut
      ? "Out of time. No points on this one."
      : passed
        ? "No points, on to the next one."
        : said
          ? `${r.name ?? `“${said}”`} isn't a valid answer here.`
          : "No points on this one.";
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.85, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: big ? 260 : 420, damping: big ? 14 : 24 }}
      className={`relative overflow-hidden rounded-[22px] border-[2.5px] border-ink p-5 shadow-[var(--shadow-pop)] ${TIER_PANEL[t ?? "miss"]}`}
      aria-live="polite"
    >
      {t === "halfcourt" && !reduce && <Flames />}
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-2">
        <div className="min-w-0">
          {r.name && t && <p className="truncate text-sm font-bold opacity-80">{r.name}</p>}
          <p className={`varsity leading-none ${big ? "text-[2rem] sm:text-5xl" : "text-[1.7rem] sm:text-4xl"}`}>{headline}</p>
        </div>
        <div className="text-right">
          <p className="varsity tnum text-[2rem] leading-none sm:text-5xl">+{r.points}</p>
          <p className="mt-1 text-xs font-bold whitespace-nowrap opacity-80 sm:text-sm">+{r.feet} ft of range</p>
        </div>
        <p className="col-span-2 font-semibold opacity-85">{sub}</p>
      </div>
    </motion.div>
  );
}

function Timer({ left, limit }: { left: number; limit: number }) {
  const frac = Math.max(0, Math.min(1, left / limit));
  const r = 22;
  const c = 2 * Math.PI * r;
  const hurry = left < 6000;
  return (
    <div className={`relative grid h-16 w-16 shrink-0 place-items-center ${hurry ? "dc-hurry" : ""}`} role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="#fff" stroke="var(--color-wash)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={hurry ? "var(--color-coral)" : "var(--color-sky-deep)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 100ms linear" }}
        />
        <circle cx="28" cy="28" r={r + 3.5} fill="none" stroke="var(--color-ink)" strokeWidth="2.5" />
      </svg>
      <span className="varsity tnum relative text-xl">{Math.ceil(left / 1000)}</span>
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
        void loadNameIndex().catch(() => {});
        const r = await api<{ mode: Mode; date: string; day: string; puzzleNumber: number | null; token: string; index: number; total: number; limitMs: number; prompt: ServedPrompt }>(
          "/api/deep-cut/start",
          { device: deviceId(), mode: m, day },
        );
        persist({ v: 1, mode: r.mode, date: r.date, day: r.day, puzzleNumber: r.puzzleNumber, token: r.token, index: r.index, total: r.total, limitMs: r.limitMs, prompt: r.prompt, shownAt: Date.now(), reveal: null, history: [] });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [persist],
  );

  const open = useCallback((m: Mode, day?: string | null) => {
    setMode(m);
    setError(null);
    setShot(null);
    void loadNameIndex().catch(() => {});
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

  const answer = useCallback(
    async (pick: { pid: string | null; text: string } | null, passed = false) => {
      if (!s?.prompt || s.reveal || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const r = await api<Reveal>("/api/deep-cut/answer", { token: s.token, pid: pick?.pid ?? null, text: pick?.pid ? undefined : pick?.text });
        const { token, done, ...rest } = r;
        const said = pick?.text ?? null;
        persist({ ...s, token, reveal: r, said: { text: said, passed }, history: [...s.history, { prompt: s.prompt, said, passed, reveal: rest }], done });
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
      const r = await api<{ index: number; total: number; limitMs: number; prompt: ServedPrompt; token: string }>("/api/deep-cut/next", { token: s.token });
      setShot(null);
      persist({ ...s, token: r.token, index: r.index, prompt: r.prompt, limitMs: r.limitMs, shownAt: Date.now(), reveal: null, said: undefined });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Shot clock; at zero the prompt is submitted with no answer.
  const live = !!s?.prompt && !s.reveal && !s.done;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [live]);
  const left = live && s?.shownAt ? Math.max(0, s.limitMs - (now - s.shownAt)) : 0;
  useEffect(() => {
    if (live && left <= 0 && !busyRef.current) void answer(null);
  }, [live, left, answer]);

  const score = s?.reveal?.score ?? s?.history.at(-1)?.reveal.score ?? 0;
  const feet = Math.round(score) / 10;

  const header = (
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

  const shell = (children: React.ReactNode) => <div className="mx-auto max-w-6xl px-4 pt-6 pb-6 sm:px-6 sm:pt-8">{header}{children}</div>;

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
  if (intro && !s) {
    return shell(
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="pop rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
          <p className="text-sm font-bold text-coral-deep">{mode === "daily" ? "Today’s seven prompts" : mode === "archive" ? "A past day’s seven prompts" : "Seven random prompts"}</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Rarer answers score more.</h2>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            Each prompt has many right answers. Name one player in 25 seconds. The answer everyone says is a layup. The one nobody thinks of is a shot from way downtown.
          </p>
          <div className="mt-5">
            <TierLadder />
          </div>
          <p className="mt-4 text-sm font-semibold text-ink-soft">Every 10 points is a foot of range. A perfect day is 700 points: a 70-foot heave.</p>
          {error && <p className="mt-4 font-semibold text-coral-deep">{error}</p>}
          <button type="button" className="btn btn-coral mt-5 px-6 text-lg" onClick={() => void begin(mode, archiveDay ?? undefined)}>
            {mode === "daily" ? `Start Deep Cut #${puzzleNumber(puzzleDate())}` : mode === "archive" ? `Start #${puzzleNumber(archiveDay!)}` : "Start"}
          </button>
        </div>
        <div className="pop hidden overflow-hidden rounded-[var(--radius-card)] bg-sky p-3 lg:block">
          <RangeMeter feet={0} className="mx-auto block h-auto w-full max-w-[300px] rounded-[20px]" />
        </div>
      </section>,
    );
  }

  if (!s) {
    return shell(
      <div className="grid min-h-[40vh] place-items-center text-center">
        {error ? (
          <div className="grid gap-4">
            <p className="text-lg font-semibold">{error}</p>
            <button className="btn btn-coral mx-auto" onClick={() => void begin(mode, archiveDay ?? undefined)}>
              Try again
            </button>
          </div>
        ) : (
          <p className="animate-pulse text-lg font-semibold text-ink-soft">Walking out to the court…</p>
        )}
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
                <span className="font-semibold">{r.answer ?? (s.history[i]?.said ? `“${s.history[i].said}”` : "No answer")}</span>
              </p>
              {r.rare.length > 0 && (
                <p className="mt-2 text-sm text-ink-soft">
                  <span className="font-bold text-ink">Deep cuts you could’ve had: </span>
                  {r.rare.map((x, k) => (
                    <span key={x.n}>
                      {k > 0 && ", "}
                      {x.n.replace(/\s*\(.*\)$/, "")} <span className="text-xs font-bold">({TIER_LABEL[x.tier]})</span>
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

  // ----- Playing -----
  const p = s.prompt!;
  const r = s.reveal;
  return shell(
    <>
      {error && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-[2.5px] border-ink bg-coral-soft px-4 py-3">
          <span className="font-semibold">{error}</span>
          {/expired/i.test(error) && (
            <button className="btn btn-white px-3 py-1 text-sm" onClick={() => { remove(keyFor(s.mode, s.day)); void begin(s.mode, s.mode === "archive" ? s.day : undefined); }}>
              Reload
            </button>
          )}
        </div>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-start">
        <div className="grid min-w-0 gap-4">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="flex items-center gap-1.5" aria-label={`Prompt ${s.index + 1} of ${s.total}`}>
              {Array.from({ length: s.total }, (_, i) => {
                const h = s.history[i];
                return (
                  <span
                    key={i}
                    className={`h-3.5 w-3.5 rounded-full border-2 border-ink ${h ? TIER_CHIP[h.reveal.tier ?? "miss"].split(" ")[0] : i === s.index ? "bg-butter" : "bg-white"}`}
                  />
                );
              })}
              <span className="ml-2">
                Prompt <span className="varsity">{s.index + 1}</span> of {s.total}
              </span>
            </span>
            <span className="tnum text-right">
              <span className="varsity text-base">{score}</span> pts · <span className="varsity text-base">{feet}</span> ft
            </span>
          </div>

          <motion.section
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="pop rounded-[var(--radius-card)] bg-white p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-sky px-2.5 py-1">{p.kind === "general" ? "General" : "Specific"}</span>
                  <span className="rounded-full bg-wash px-2.5 py-1">{p.count.toLocaleString()} valid answers</span>
                </p>
                <h2 className="mt-3 text-[1.75rem] leading-[1.12] font-extrabold tracking-tight text-balance sm:text-[2.4rem]">{p.text}</h2>
                {p.note && <p className="mt-2 text-sm font-medium text-ink-soft">{p.note}</p>}
              </div>
              {!r && <Timer left={left} limit={s.limitMs} />}
            </div>
            <div className="mt-6">
              <AnimatePresence mode="wait" initial={false}>
                {r ? (
                  <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4">
                    <RevealCard r={r} said={s.said?.text ?? null} passed={!!s.said?.passed} />
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
                  <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <NameInput key={p.id} disabled={busy} onShoot={(pick) => void answer(pick)} onPass={() => void answer(null, true)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
          <div className="lg:hidden">
            <div className="pop overflow-hidden rounded-[var(--radius-card)] bg-sky p-1.5">
              <RangeMeter feet={feet} orientation="horizontal" shot={shot} className="h-auto w-full" label={false} />
            </div>
          </div>
        </div>
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <div className="pop rounded-[var(--radius-card)] bg-white p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-bold">Your range</p>
              <p className="text-sm font-semibold text-ink-soft">{zoneFor(feet).label}</p>
            </div>
            <p className="varsity tnum text-4xl leading-tight">
              {feet}
              <span className="ml-1 text-xl">ft</span>
            </p>
            <div className="mx-auto mt-2 w-full max-w-[270px] overflow-hidden rounded-[20px] border-[2.5px] border-ink">
              <RangeMeter feet={feet} shot={shot} className="block h-auto w-full" />
            </div>
            <div className="mt-3">
              <TierLadder compact />
            </div>
          </div>
        </aside>
      </div>
    </>,
  );
}
