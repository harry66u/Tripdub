import { hashSeed, rng, weightedIndex } from "@/lib/rng";
import { SLOTS, type Lineup, type SFPlayer, type Slot } from "../types";
import { gradeLineup } from "./grades";

export type PlayerBox = {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  tov: number;
};

export type TeamBox = { score: number; quarters: number[]; players: Record<Slot, PlayerBox> };

export type PlayKind = "rim" | "mid" | "three" | "ft" | "block" | "steal";

/** One moment of the featured game, for the play-by-play replay. */
export type Play = {
  /** Period (1-4, then overtimes) */
  q: number;
  /** Seconds left in the period */
  t: number;
  side: "home" | "away";
  slot: Slot;
  kind: PlayKind;
  /** Points scored on the play (free throws: how many went in) */
  pts: number;
  /** Assisting teammate, or the player who was blocked / stripped */
  other?: Slot;
  h: number;
  a: number;
};

export type GameResult = {
  home: TeamBox;
  away: TeamBox;
  leadChanges: number;
  biggestLead: { side: "home" | "away"; pts: number };
  plays?: Play[];
};

type Emit = (team: Team, kind: PlayKind, slot: number, pts: number, other?: number) => void;

export type Evaluation = {
  /** Probability the home lineup wins, 0..1 */
  winProb: number;
  meanMargin: number;
  sdMargin: number;
  /** The median-margin game: the one we show */
  featured: GameResult;
  featuredSeed: number;
};

const POSSESSIONS_PER_QUARTER = 25;
const OT_POSSESSIONS = 6;
const BASE = { rim: 0.62, mid: 0.41, three: 0.355 } as const;
const FOUL_RATE = { rim: 0.2, mid: 0.07, three: 0.03 } as const;
type ShotType = keyof typeof BASE;

type Team = {
  players: SFPlayer[]; // in SLOTS order
  spc: number;
  ply: number;
  reb: number;
  bestRim: number;
  usageW: number[];
  handlerW: number[];
  rebW: number[];
  passW: number[];
  stealW: number[];
  blockW: number[];
  ft: number[];
  shotMix: { rim: number; mid: number; three: number }[];
  box: PlayerBox[];
  score: number;
  quarters: number[];
};

const emptyBox = (): PlayerBox => ({
  pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, tov: 0,
});

const norm = (v: number) => (v - 50) / 50;

function prepare(lineup: Lineup): Team {
  const players = SLOTS.map((s) => lineup[s]);
  const g = gradeLineup(players);
  return {
    players,
    spc: g.spc,
    ply: g.ply,
    reb: g.reb,
    bestRim: Math.max(...players.map((p) => p.r.rim)),
    usageW: players.map((p) => p.usg * (0.6 + p.r.sco / 100)),
    handlerW: players.map((p) => p.usg * (1 + p.r.ply / 100)),
    rebW: players.map((p) => (p.r.reb + 5) ** 2),
    passW: players.map((p) => (p.r.ply + 5) ** 2),
    stealW: players.map((p) => (p.r.per + 5) ** 2),
    blockW: players.map((p) => (p.r.rim + 5) ** 2),
    ft: players.map((p) => p.line.ftPct ?? 0.55 + (0.35 * p.r.spc) / 100),
    shotMix: players.map((p) => {
      // Good spacing pulls more threes out of everyone.
      const three = p.shot.three * (0.85 + (0.3 * g.spc) / 100);
      const total = p.shot.rim + p.shot.mid + three;
      return { rim: p.shot.rim / total, mid: p.shot.mid / total, three: three / total };
    }),
    box: players.map(emptyBox),
    score: 0,
    quarters: [],
  };
}

function excluding(weights: number[], i: number): number[] {
  return weights.map((w, j) => (j === i ? 0 : w));
}

function possession(off: Team, def: Team, r: () => number, emit?: Emit): number {
  // Turnover: good playmaking protects the ball; active hands take it away.
  const defPer = def.players.reduce((s, p) => s + p.r.per, 0) / 5;
  const pTo = 0.16 - (0.06 * off.ply) / 100 + 0.02 * norm(defPer);
  if (r() < pTo) {
    const h = weightedIndex(off.handlerW, r);
    off.box[h].tov++;
    if (r() < 0.5) {
      const st = weightedIndex(def.stealW, r);
      def.box[st].stl++;
      emit?.(def, "steal", st, 0, h);
    }
    return 0;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const si = weightedIndex(off.usageW, r);
    const shooter = off.players[si];
    const defender = def.players[si]; // same-slot matchup
    const mix = off.shotMix[si];
    const roll = r();
    const type: ShotType = roll < mix.rim ? "rim" : roll < mix.rim + mix.mid ? "mid" : "three";
    const box = off.box[si];

    if (r() < FOUL_RATE[type]) {
      // Shooting foul: two free throws, three on a three.
      let made = 0;
      for (let k = 0; k < (type === "three" ? 3 : 2); k++) {
        box.fta++;
        if (r() < off.ft[si]) {
          box.ftm++;
          box.pts++;
          off.score++;
          made++;
        }
      }
      emit?.(off, "ft", si, made);
      return 1;
    }

    let p: number = BASE[type];
    if (type === "three") {
      p += 0.1 * norm(shooter.r.spc);
      p -= 0.08 * norm(defender.r.per);
    } else if (type === "mid") {
      p += 0.12 * norm(shooter.r.sco);
      p -= 0.11 * norm(defender.r.per);
    } else {
      p += 0.12 * norm(shooter.r.sco);
      const rimD = 0.7 * defender.r.rim + 0.3 * def.bestRim;
      p -= 0.1 * norm(rimD);
      p += 0.03 * norm(off.spc);
    }
    p += 0.02 * norm(off.ply);
    p = Math.min(0.85, Math.max(0.15, p));

    box.fga++;
    if (type === "three") box.fg3a++;
    if (r() < p) {
      const pts = type === "three" ? 3 : 2;
      box.fgm++;
      if (type === "three") box.fg3m++;
      box.pts += pts;
      off.score += pts;
      // Teams with real playmakers assist on more of their buckets.
      let assist: number | undefined;
      if (r() < 0.45 + (0.25 * off.ply) / 100) {
        assist = weightedIndex(excluding(off.passW, si), r);
        off.box[assist].ast++;
      }
      emit?.(off, type, si, pts, assist);
      return 1;
    }
    if (type === "rim" && r() < 0.4) {
      const bw = def.blockW.slice();
      bw[si] *= 2;
      const bk = weightedIndex(bw, r);
      def.box[bk].blk++;
      emit?.(def, "block", bk, 0, si);
    }
    const pOreb = 0.27 + (0.1 * (off.reb - def.reb)) / 100;
    if (r() < pOreb) {
      off.box[weightedIndex(off.rebW, r)].reb++;
      continue;
    }
    def.box[weightedIndex(def.rebW, r)].reb++;
    return 1;
  }
  return 1;
}

export function simulateGame(home: Lineup, away: Lineup, seed: number, opts: { log?: boolean } = {}): GameResult {
  const r = rng(seed);
  const h = prepare(home);
  const a = prepare(away);
  let leadChanges = 0;
  let leader: "home" | "away" | null = null;
  let biggest = { side: "home" as "home" | "away", pts: 0 };
  const plays: Play[] | null = opts.log ? [] : null;
  let clock = { q: 1, t: 720 };
  // Recording only: never draws from the RNG, so a logged game is the same game.
  const emit: Emit | undefined = plays
    ? (team, kind, slot, pts, other) =>
        plays.push({
          q: clock.q,
          t: Math.round(clock.t),
          side: team === h ? "home" : "away",
          slot: SLOTS[slot],
          kind,
          pts,
          ...(other != null ? { other: SLOTS[other] } : {}),
          h: h.score,
          a: a.score,
        })
    : undefined;
  const track = () => {
    const diff = h.score - a.score;
    const now = diff > 0 ? "home" : diff < 0 ? "away" : leader;
    if (leader && now && now !== leader) leadChanges++;
    leader = now;
    if (Math.abs(diff) > biggest.pts) biggest = { side: diff > 0 ? "home" : "away", pts: Math.abs(diff) };
  };
  const period = (q: number, n: number, seconds: number) => {
    const hs = h.score;
    const as = a.score;
    const step = seconds / (2 * n);
    for (let i = 0; i < n; i++) {
      clock = { q, t: seconds - step * (2 * i + 1) };
      possession(h, a, r, emit);
      track();
      clock = { q, t: seconds - step * (2 * i + 2) };
      possession(a, h, r, emit);
      track();
    }
    h.quarters.push(h.score - hs);
    a.quarters.push(a.score - as);
  };
  for (let q = 1; q <= 4; q++) period(q, POSSESSIONS_PER_QUARTER, 720);
  for (let q = 5; h.score === a.score; q++) period(q, OT_POSSESSIONS, 300);

  const toBox = (t: Team): TeamBox => ({
    score: t.score,
    quarters: t.quarters,
    players: Object.fromEntries(SLOTS.map((s, i) => [s, t.box[i]])) as Record<Slot, PlayerBox>,
  });
  return { home: toBox(h), away: toBox(a), leadChanges, biggestLead: biggest, ...(plays ? { plays } : {}) };
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 erf approximation). */
function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/**
 * Play the matchup `n` times. The win probability comes from the margin distribution; the
 * featured game is the one closest to the median margin (on the side the mean favors), so the
 * score we show always agrees with the number on the leaderboard.
 */
export function evaluateMatchup(home: Lineup, away: Lineup, baseSeed: number, n = 400): Evaluation {
  const margins: number[] = new Array(n);
  const seeds: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    seeds[i] = hashSeed(baseSeed, i);
    const g = simulateGame(home, away, seeds[i]);
    margins[i] = g.home.score - g.away.score;
  }
  const mean = margins.reduce((s, m) => s + m, 0) / n;
  const sd = Math.sqrt(margins.reduce((s, m) => s + (m - mean) ** 2, 0) / n);
  const sorted = margins.slice().sort((x, y) => x - y);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const want = Math.sign(mean) || 1;
  let best = -1;
  for (let i = 0; i < n; i++) {
    if (Math.sign(margins[i]) !== want) continue;
    if (best < 0 || Math.abs(margins[i] - median) < Math.abs(margins[best] - median)) best = i;
  }
  if (best < 0) best = 0;
  const winProb = sd > 0 ? phi(mean / sd) : mean > 0 ? 1 : mean < 0 ? 0 : 0.5;
  return {
    winProb,
    meanMargin: mean,
    sdMargin: sd,
    featured: simulateGame(home, away, seeds[best], { log: true }),
    featuredSeed: seeds[best],
  };
}
