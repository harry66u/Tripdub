"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/common/Countdown";
import { GameHeader, type Mode } from "@/components/common/ModeTabs";
import { ShareButton } from "@/components/common/ShareButton";
import { Headshot } from "@/components/starting-five/Headshot";
import { Jersey, TeamLogo } from "@/components/starting-five/TeamArt";
import { formatSeason, topPercent } from "@/games/starting-five/engine/format";
import type { ZoneId } from "@/games/shot-chart/types";
import { addDays, puzzleDate } from "@/lib/day";
import { deviceId } from "@/lib/client/device";
import { markDailyDone } from "@/lib/client/progress";
import { load, remove, save } from "@/lib/client/storage";
import { ShotCourt, type ServedZone } from "./ShotCourt";

type Round = {
  index: number;
  total: number;
  tier: number;
  tierLabel: string;
  choices: string[];
  zones: Record<ZoneId, ServedZone>;
  fga: number;
  fgPct: number;
};

type Answer = {
  name: string;
  season: number;
  team: { abbr: string; name: string };
  nbaId: number;
  pos: string;
  line: { pts: number | null; reb: number | null; ast: number | null };
  allStar: boolean;
  fga: number;
};

type Reveal = {
  correct: boolean;
  timedOut: boolean;
  correctIndex: number;
  answer: Answer;
  points: { base: number; speed: number; total: number };
  ms: number;
  score: number;
  index: number;
  total: number;
  token: string;
  done?: { score: number; results: boolean[]; percentile: number | null; total: number | null; share: string };
};

type Saved = {
  v: 1;
  mode: Mode;
  date: string;
  puzzleNumber: number | null;
  token: string;
  limitMs: number;
  round: Round;
  shownAt: number;
  reveal: Reveal | null;
  picked: number | null;
  history: { answer: Answer; correct: boolean; pts: number; guess: string | null }[];
  done?: Reveal["done"];
  finished?: boolean;
};

const keyFor = (m: Mode) => `tripdub:shot:v1:${m}`;

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

export function ShotChartGame() {
  const [mode, setMode] = useState<Mode>("daily");
  const [s, setS] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);

  const persist = useCallback((next: Saved) => {
    setS(next);
    save(keyFor(next.mode), next);
  }, []);

  const begin = useCallback(
    async (m: Mode) => {
      setS(null);
      setError(null);
      try {
        const r = await api<{ mode: Mode; date: string; puzzleNumber: number | null; limitMs: number; round: Round; token: string }>("/api/shot/start", {
          device: deviceId(),
          mode: m,
        });
        persist({ v: 1, mode: r.mode, date: r.date, puzzleNumber: r.puzzleNumber, token: r.token, limitMs: r.limitMs, round: r.round, shownAt: Date.now(), reveal: null, picked: null, history: [] });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [persist],
  );

  const open = useCallback(
    (m: Mode) => {
      setMode(m);
      const saved = load<Saved>(keyFor(m));
      if (resumable(saved)) setS(saved);
      else void begin(m);
    },
    [begin],
  );

  useEffect(() => {
    open(new URLSearchParams(window.location.search).get("mode") === "unlimited" ? "unlimited" : "daily");
  }, [open]);

  const guess = useCallback(
    async (choice: number | null) => {
      if (!s || s.reveal || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const r = await api<Reveal>("/api/shot/guess", { token: s.token, choice });
        const next: Saved = {
          ...s,
          token: r.token,
          reveal: r,
          picked: choice,
          history: [...s.history, { answer: r.answer, correct: r.correct, pts: r.points.total, guess: choice == null ? null : s.round.choices[choice] }],
          done: r.done,
        };
        persist(next);
        if (r.done && s.mode === "daily") {
          const right = r.done.results.filter(Boolean).length;
          markDailyDone("shot", s.date, `${right}/5 right, ${r.done.score.toLocaleString()} pts`, r.done.share);
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

  const nextRound = async () => {
    if (!s || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await api<{ limitMs: number; round: Round; token: string }>("/api/shot/next", { token: s.token });
      persist({ ...s, token: r.token, round: r.round, limitMs: r.limitMs, shownAt: Date.now(), reveal: null, picked: null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const live = !!s && !s.reveal && !s.done;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [live]);
  const left = live && s ? Math.max(0, s.limitMs - (now - s.shownAt)) : 0;
  useEffect(() => {
    if (live && left <= 0 && !busyRef.current) void guess(null);
  }, [live, left, guess]);

  const header = <GameHeader title="Shot Chart" mode={mode} puzzleNumber={s?.puzzleNumber ?? null} date={s?.date ?? null} onMode={(m) => open(m)} />;

  if (!s) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
        {header}
        <div className="grid min-h-[40vh] place-items-center text-center">
          {error ? (
            <div className="grid gap-4">
              <p className="text-lg font-semibold">{error}</p>
              <button className="btn btn-coral mx-auto" onClick={() => void begin(mode)}>
                Try again
              </button>
            </div>
          ) : (
            <p className="animate-pulse text-lg font-semibold text-ink-soft">Pulling the charts…</p>
          )}
        </div>
      </div>
    );
  }

  if (s.done && s.finished) {
    const d = s.done;
    const right = d.results.filter(Boolean).length;
    return (
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
        {header}
        <section className="mt-6 rounded-[var(--radius-card)] border-[2.5px] border-ink bg-ink p-6 text-white shadow-[var(--shadow-pop-lg)]">
          <p className="text-sm font-semibold text-sky">Final score</p>
          <p className="varsity tnum text-6xl leading-none">{d.score.toLocaleString()}</p>
          <p className="mt-3 text-2xl tracking-widest">{d.results.map((ok) => (ok ? "🎯" : "❌")).join("")}</p>
          <p className="mt-2 font-semibold text-sky">
            {right} of 5 right
            {d.percentile != null && d.total != null && ` · Top ${topPercent(d.percentile)}% of ${d.total.toLocaleString()} today`}
          </p>
        </section>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {s.history.map((h, i) => (
            <li key={i} className="pop-sm flex items-center gap-3 rounded-[18px] bg-white p-3">
              <Headshot player={{ name: h.answer.name, nbaId: h.answer.nbaId, season: h.answer.season, team: h.answer.team }} size="sm" />
              <div className="min-w-0">
                <p className="font-bold leading-tight">
                  <span className="varsity mr-1 text-xs text-coral-deep">{h.answer.season}</span>
                  {h.answer.name}
                </p>
                <p className="text-xs font-semibold text-ink-soft">
                  {h.correct ? `Got it, +${h.pts}` : h.guess ? `You said ${h.guess}` : "Out of time"}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="pop mt-6 flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-sky p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-extrabold">Share your score</p>
            <p className="text-sm">No names, just the targets.</p>
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
      </div>
    );
  }

  const r = s.reveal;
  const score = r?.score ?? s.history.reduce((a, h) => a + h.pts, 0);
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8">
      {header}
      {error && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-[2.5px] border-ink bg-coral-soft px-4 py-3">
          <span className="font-semibold">{error}</span>
          {/expired/i.test(error) && (
            <button className="btn btn-white px-3 py-1 text-sm" onClick={() => { remove(keyFor(s.mode)); void begin(s.mode); }}>
              Reload
            </button>
          )}
        </div>
      )}
      <div className="mt-6 flex items-center justify-between text-sm font-semibold">
        <span>
          Round <span className="varsity">{s.round.index + 1}</span> of {s.round.total}
          <span className="ml-2 rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">{s.round.tierLabel}</span>
        </span>
        <span className="tnum">
          Score <span className="varsity text-base">{score.toLocaleString()}</span>
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
        <div className={`h-full rounded-full ${left < 5000 && !r ? "bg-coral" : "bg-sky-deep"}`} style={{ width: `${r ? 0 : (left / s.limitMs) * 100}%`, transition: "width 100ms linear" }} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <section className="pop min-w-0 rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-extrabold">Whose season is this?</h2>
          <ShotCourt zones={s.round.zones} fga={s.round.fga} fgPct={s.round.fgPct} />
        </section>

        <section className="grid min-w-0 gap-3">
          {!r ? (
            <>
              {s.round.choices.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  disabled={busy}
                  onClick={() => void guess(i)}
                  className="pop-sm rounded-[18px] bg-white px-4 py-4 text-left text-lg font-extrabold transition-transform hover:-translate-y-0.5 hover:bg-butter-soft active:translate-y-0.5"
                >
                  {name}
                </button>
              ))}
              <p className="text-center text-sm font-semibold text-ink-soft">
                <span className="tnum">{Math.ceil(left / 1000)}s</span> left. Faster right guesses score more.
              </p>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pop overflow-hidden rounded-[var(--radius-card)] bg-white">
              <div className={`border-b-[2.5px] border-ink px-5 py-2 text-sm font-bold ${r.correct ? "bg-mint" : "bg-coral text-white"}`}>
                {r.correct ? `Nailed it, +${r.points.total}` : r.timedOut ? "Out of time" : `Not ${s.picked != null ? s.round.choices[s.picked] : "him"}`}
              </div>
              <div className="p-4">
                <div className="relative">
                  <Headshot player={{ name: r.answer.name, nbaId: r.answer.nbaId, season: r.answer.season, team: r.answer.team }} size="lg" />
                  <span className="absolute top-2.5 left-2.5 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-white p-1 empty:hidden">
                    <TeamLogo team={r.answer.team} className="h-full w-full" />
                  </span>
                  <Jersey team={r.answer.team} className="absolute bottom-2 left-2.5 h-14 w-12 drop-shadow-[2px_3px_0_var(--color-ink)]" />
                </div>
                <p className="mt-3 text-2xl leading-tight font-extrabold">
                  <span className="varsity mr-2 text-xl text-coral-deep">{r.answer.season}</span>
                  {r.answer.name}
                </p>
                <p className="text-sm font-semibold text-ink-soft">
                  {r.answer.team.name}, {formatSeason(r.answer.season)}
                  {r.answer.allStar && <span className="ml-2 rounded-full border-[1.5px] border-ink/70 px-2 py-0.5 text-xs text-ink">All-Star</span>}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border-2 border-ink bg-wash px-2 py-2 text-center">
                  {(["pts", "reb", "ast"] as const).map((k) => (
                    <div key={k}>
                      <dt className="text-[11px] font-semibold text-ink-soft uppercase">{k}</dt>
                      <dd className="varsity tnum text-lg">{r.answer.line[k] ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  className="btn btn-coral mt-4"
                  disabled={busy}
                  onClick={() => (r.index + 1 >= r.total ? persist({ ...s, finished: true }) : void nextRound())}
                >
                  {r.index + 1 >= r.total ? "See your results" : "Next chart"}
                </button>
              </div>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
