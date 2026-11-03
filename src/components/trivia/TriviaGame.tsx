"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/common/Countdown";
import { GameHeader, type Mode } from "@/components/common/ModeTabs";
import { ShareButton } from "@/components/common/ShareButton";
import { answerEmoji } from "@/games/trivia/engine/share";
import type { Points } from "@/games/trivia/engine/scoring";
import type { ServedQuestion } from "@/games/trivia/types";
import { topPercent } from "@/games/starting-five/engine/format";
import { addDays, puzzleDate } from "@/lib/day";
import { deviceId } from "@/lib/client/device";
import { markDailyDone } from "@/lib/client/progress";
import { load, remove, save } from "@/lib/client/storage";

type Reveal = {
  correct: boolean;
  timedOut: boolean;
  correctIndex: number;
  answer: string;
  points: Points;
  ms: number;
  pctCorrect: number | null;
  answeredBy: number | null;
  score: number;
  index: number;
  total: number;
  token: string;
  done?: { score: number; results: { correct: boolean; ms: number; pts: number }[]; percentile: number | null; total: number | null; share: string };
};

type HistoryItem = { q: string; options: string[]; choice: number | null; reveal: Omit<Reveal, "token" | "done"> };

type Saved = {
  v: 1;
  mode: Mode;
  date: string;
  puzzleNumber: number | null;
  token: string;
  index: number;
  total: number;
  limitMs: number;
  question: ServedQuestion | null;
  /** Client clock when the current question appeared */
  shownAt: number | null;
  reveal: Reveal | null;
  history: HistoryItem[];
  done?: Reveal["done"];
  /** The player has moved on from the last reveal to the results */
  finished?: boolean;
};

const keyFor = (m: Mode) => `tripdub:trivia:v1:${m}`;
const LETTERS = ["A", "B", "C", "D"];

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

export function TriviaGame() {
  const [mode, setMode] = useState<Mode>("daily");
  const [s, setS] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState<number | null>(null);
  const busyRef = useRef(false);

  const persist = useCallback((next: Saved) => {
    setS(next);
    save(keyFor(next.mode), next);
  }, []);

  const begin = useCallback(
    async (m: Mode) => {
      setS(null);
      setError(null);
      setPicked(null);
      try {
        const r = await api<{ mode: Mode; date: string; puzzleNumber: number | null; token: string; index: number; total: number; limitMs: number; question: ServedQuestion }>(
          "/api/trivia/start",
          { device: deviceId(), mode: m },
        );
        persist({ v: 1, mode: r.mode, date: r.date, puzzleNumber: r.puzzleNumber, token: r.token, index: r.index, total: r.total, limitMs: r.limitMs, question: r.question, shownAt: Date.now(), reveal: null, history: [] });
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
      if (resumable(saved)) {
        setS(saved);
        setPicked(null);
      } else void begin(m);
    },
    [begin],
  );

  useEffect(() => {
    open(new URLSearchParams(window.location.search).get("mode") === "unlimited" ? "unlimited" : "daily");
  }, [open]);

  const answer = useCallback(
    async (choice: number | null) => {
      if (!s?.question || s.reveal || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setPicked(choice);
      try {
        const r = await api<Reveal>("/api/trivia/answer", { token: s.token, choice });
        const { token, done, ...rest } = r;
        const next: Saved = {
          ...s,
          token,
          reveal: r,
          history: [...s.history, { q: s.question.q, options: s.question.options, choice, reveal: rest }],
          done,
        };
        persist(next);
        if (done && s.mode === "daily") {
          const right = done.results.filter((x) => x.correct).length;
          markDailyDone("trivia", s.date, `${right}/${done.results.length} right, ${done.score.toLocaleString()} pts`, done.share);
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

  const nextQuestion = async () => {
    if (!s || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await api<{ index: number; total: number; limitMs: number; question: ServedQuestion; token: string }>("/api/trivia/next", { token: s.token });
      setPicked(null);
      persist({ ...s, token: r.token, index: r.index, question: r.question, limitMs: r.limitMs, shownAt: Date.now(), reveal: null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Countdown; at zero the question is submitted as a timeout.
  const live = !!s?.question && !s.reveal && !s.done;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [live]);
  const left = live && s?.shownAt ? Math.max(0, s.limitMs - (now - s.shownAt)) : 0;
  useEffect(() => {
    if (live && left <= 0 && !busyRef.current) void answer(null);
  }, [live, left, answer]);

  // Keys 1-4 answer on desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!live || busy) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 4) void answer(k - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, busy, answer]);

  const header = (
    <GameHeader title="Daily Trivia" mode={mode} puzzleNumber={s?.puzzleNumber ?? null} date={s?.date ?? null} onMode={(m) => open(m)} />
  );

  if (!s) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
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
            <p className="animate-pulse text-lg font-semibold text-ink-soft">Shuffling the questions…</p>
          )}
        </div>
      </div>
    );
  }

  if (s.done && s.finished) {
    const d = s.done;
    const right = d.results.filter((r) => r.correct).length;
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
        {header}
        <section className="mt-6 rounded-[var(--radius-card)] border-[2.5px] border-ink bg-ink p-6 text-white shadow-[var(--shadow-pop-lg)]">
          <p className="text-sm font-semibold text-sky">Final score</p>
          <p className="varsity tnum text-6xl leading-none">{d.score.toLocaleString()}</p>
          <p className="mt-3 text-2xl tracking-widest" aria-label={`${right} of ${d.results.length} right`}>
            {d.results.map(answerEmoji).join("")}
          </p>
          <p className="mt-2 font-semibold text-sky">
            {right} of {d.results.length} right
            {d.percentile != null && d.total != null && ` · Top ${topPercent(d.percentile)}% of ${d.total.toLocaleString()} today`}
          </p>
        </section>
        <ol className="mt-6 grid gap-3">
          {s.history.map((h, i) => (
            <li key={i} className="pop-sm rounded-[18px] bg-white p-4">
              <p className="text-sm font-semibold text-ink-soft">
                Question {i + 1}
                <span className="ml-2 font-bold text-ink">{h.reveal.points.total ? `+${h.reveal.points.total}` : "0"}</span>
              </p>
              <p className="mt-1 font-bold">{h.q}</p>
              <p className="mt-1 text-sm">
                {h.reveal.correct ? (
                  <span className="font-semibold text-[#1d7a55]">You got it: {h.reveal.answer}</span>
                ) : (
                  <>
                    <span className="font-semibold text-coral-deep">
                      {h.choice == null ? "Out of time" : `You said ${h.options[h.choice]}`}
                    </span>
                    <span className="text-ink-soft">. Answer: {h.reveal.answer}</span>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
        <div className="pop mt-6 flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-sky p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-extrabold">Share your score</p>
            <p className="text-sm">Emoji only, no spoilers.</p>
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

  const q = s.question!;
  const r = s.reveal;
  const pct = r?.pctCorrect;
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8">
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
          Question <span className="varsity">{s.index + 1}</span> of {s.total}
        </span>
        <span className="tnum">
          Score <span className="varsity text-base">{(r?.score ?? s.history.at(-1)?.reveal.score ?? 0).toLocaleString()}</span>
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
        <div
          className={`h-full rounded-full ${left < 4000 && !r ? "bg-coral" : "bg-sky-deep"}`}
          style={{ width: `${r ? 0 : (left / s.limitMs) * 100}%`, transition: "width 100ms linear" }}
        />
      </div>

      <motion.section
        key={q.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pop mt-5 rounded-[var(--radius-card)] bg-white p-5 sm:p-7"
      >
        <p className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-sky px-2.5 py-1">{q.cat}</span>
          <span className="rounded-full bg-wash px-2.5 py-1 capitalize">{q.diff}</span>
          {!r && <span className="tnum ml-auto rounded-full bg-ink px-2.5 py-1 text-white">{Math.ceil(left / 1000)}s</span>}
        </p>
        <h2 className="mt-4 text-2xl leading-snug font-extrabold text-balance sm:text-[1.7rem]">{q.q}</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {q.options.map((o, i) => {
            const isRight = r && i === r.correctIndex;
            const isWrongPick = r && i === picked && !r.correct;
            return (
              <button
                key={i}
                type="button"
                disabled={!!r || busy}
                onClick={() => void answer(i)}
                className={`flex min-h-14 items-center gap-3 rounded-[18px] border-[2.5px] border-ink px-4 py-3 text-left font-bold transition-[transform,box-shadow,background-color] ${
                  isRight ? "bg-mint text-ink" : isWrongPick ? "bg-coral text-white" : r ? "bg-white opacity-60" : "bg-white shadow-[var(--shadow-pop-sm)] hover:-translate-y-0.5 hover:bg-butter-soft active:translate-y-0.5"
                } ${picked === i && !r ? "bg-butter" : ""}`}
              >
                <span className="varsity grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-sm text-ink">{LETTERS[i]}</span>
                <span>{o}</span>
              </button>
            );
          })}
        </div>

        {r && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid gap-3 rounded-[18px] bg-wash p-4">
            <p className="text-lg font-extrabold">
              {r.correct ? "Correct!" : r.timedOut ? "Out of time." : "Not this time."}{" "}
              {!r.correct && <span className="font-semibold">The answer is {r.answer}.</span>}
            </p>
            {r.correct && (
              <p className="flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded-full bg-white px-2.5 py-1">+{r.points.base} correct</span>
                <span className="rounded-full bg-white px-2.5 py-1">+{r.points.speed} speed</span>
                {r.points.rarity > 0 && <span className="rounded-full bg-butter px-2.5 py-1">+{r.points.rarity} rare</span>}
              </p>
            )}
            <p className="text-sm font-semibold text-ink-soft">
              {pct != null
                ? `${Math.round(pct * 100)}% of players got this right.`
                : r.answeredBy != null
                  ? `Early bird: you're one of the first ${r.answeredBy} to answer this one.`
                  : "Answer stats are warming up."}
            </p>
            <button
              type="button"
              className="btn btn-coral justify-self-start"
              disabled={busy}
              onClick={() => (r.index + 1 >= r.total ? persist({ ...s, finished: true }) : void nextQuestion())}
            >
              {r.index + 1 >= r.total ? "See your results" : "Next question"}
            </button>
          </motion.div>
        )}
      </motion.section>
      {!r && <p className="mt-3 hidden text-center text-xs font-semibold text-ink-soft sm:block">Tip: press 1–4 to answer.</p>}
    </div>
  );
}
