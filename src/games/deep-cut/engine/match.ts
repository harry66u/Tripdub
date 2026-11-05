import type { DCName } from "../types";

/** Lowercase, no accents, no punctuation: "Luka Dončić" -> "luka doncic". */
export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type IndexEntry = DCName & {
  keys: string[];
  words: string[][];
  /** keys with the spaces taken out: "lebronjames" */
  flat: string[];
  /** keys spelled by sound: "stefen kuri" */
  sound: string[];
  /** each key's words in alphabetical order, for "James LeBron" */
  sorted: string[];
  /** first and last words of each key, by sound */
  wordSounds: string[];
};
export type NameIndex = IndexEntry[];

/**
 * A rough spelling-by-sound: "Steven Curry" and "Stephen Curry" both become "stefen kuri",
 * "Jokich" and "Jokic" both "jokik", "Nowitsky" and "Nowitzki" both "nowitski".
 */
export function soundKey(s: string): string {
  return s
    .replace(/ph/g, "f")
    .replace(/([bcdfgjklmnpqrstvwxz])h/g, "$1")
    .replace(/v/g, "f")
    .replace(/ck/g, "k")
    .replace(/c(?=[aou ]|$)/g, "k")
    .replace(/q/g, "k")
    .replace(/z/g, "s")
    .replace(/x/g, "ks")
    .replace(/ie(?= |$)/g, "i")
    .replace(/y(?= |$)/g, "i")
    .replace(/ee/g, "i")
    .replace(/([a-z])\1+/g, "$1");
}

/** Names as listed (most famous first). Labels like "Patrick Ewing (1985–2002)" match on the name alone. */
export function buildIndex(names: DCName[]): NameIndex {
  return names.map((e) => {
    const base = [e.n.replace(/\s*\(.*\)\s*$/, ""), ...(e.a ?? [])].map(normName).filter(Boolean);
    // "Jaren Jackson Jr." also answers to "Jaren Jackson"
    const keys = [...new Set(base.flatMap((k) => [k, k.replace(/ (jr|sr|ii|iii|iv)$/, "")]))];
    const words = keys.map((k) => k.split(" "));
    return {
      ...e,
      keys,
      words,
      flat: keys.map((k) => k.replace(/ /g, "")),
      sound: keys.map(soundKey),
      sorted: words.map((w) => [...w].sort().join(" ")),
      wordSounds: [...new Set(words.flatMap((w) => (w.length > 1 ? [w[0], w[w.length - 1]] : w)).filter((w) => w.length > 1).map(soundKey))],
    };
  });
}

/** How far ahead in fame the best match must be before a shared name is taken to mean them. */
export const FAME_GAP = 15;
/** In fuzzy matching, one slip of the keyboard is worth this much fame. */
export const SLIP_COST = 30;
/** Two candidates closer than this (in slips x fame) are too close to call. */
export const CLOSE_CALL = 12;

export type Guess = { status: "found"; entry: IndexEntry; corrected: boolean } | { status: "ambiguous" } | { status: "none" };

/** Edit distance with swaps (optimal string alignment), giving up past `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

function famous(cands: IndexEntry[]): IndexEntry | null {
  const unique = [...new Map(cands.map((c) => [c.i, c])).values()];
  if (unique.length === 1) return unique[0];
  const sorted = unique.sort((a, b) => (b.f ?? 0) - (a.f ?? 0));
  return (sorted[0].f ?? 0) - (sorted[1].f ?? 0) >= FAME_GAP ? sorted[0] : null;
}

/** Slips allowed for a typed answer of this many letters: about one in three. */
export function slipsAllowed(len: number): number {
  return len < 4 ? 0 : len <= 5 ? 1 : len <= 8 ? 2 : len <= 11 ? 3 : len <= 15 ? 4 : 5;
}

/** Fewest slips between what was typed and this player, counting sound-alikes, run-together names, swapped order and cut-off names. */
function slips(e: IndexEntry, q: string, qFlat: string, qSound: string, qSorted: string, single: boolean, max: number): number {
  // Sound keys squeeze letters ("zzzz" -> "s"), so they get the allowance of their own, shorter length
  const soundMax = Math.min(max, slipsAllowed(qSound.replace(/ /g, "").length));
  const viaSound = (other: string) => (qSound === other ? 0 : soundMax ? editDistance(qSound, other, soundMax) : max + 1);
  let d = max + 1;
  for (let k = 0; k < e.keys.length && d > 0; k++) {
    d = Math.min(d, editDistance(q, e.keys[k], max), editDistance(qFlat, e.flat[k], max), viaSound(e.sound[k]));
    if (!single && e.sorted[k] === qSorted) d = Math.min(d, 1);
    if (!single && q.length >= 6 && e.keys[k].startsWith(q)) d = Math.min(d, 1);
    if (single) {
      for (const w of e.words[k]) {
        if (w.length < 2) continue;
        if (w === q) return 0;
        d = Math.min(d, editDistance(q, w, max));
        if (q.length >= 4 && w.length > q.length && w.startsWith(q)) d = Math.min(d, 1);
      }
    }
  }
  if (single && d > 0) for (const ws of e.wordSounds) d = Math.min(d, viaSound(ws));
  return d;
}

/** A near-miss beats exact matches only when they're all obscure (below this fame)... */
export const OBSCURE = 30;
/** ...and it is this much more famous ("Kobi" -> Kobe Bryant, but "Brown" doesn't jump to LeBron). */
export const FAMOUS_SLIP = 50;

/**
 * Who a typed answer means. Exact names, aliases and sound-alike spellings come first; when
 * several fit, the clear favorite by fame wins, or we ask ("Smith"). Otherwise every player is
 * scored by how many slips separate them from what was typed (generously: missing spaces,
 * swapped order, cut-off names, about one slip in three letters), less how famous they are.
 * A near-miss on a star beats an exact hit on an unknown ("Kobi" means Kobe Bryant).
 * Whether a player is a valid answer to the prompt never sways the choice.
 */
export function resolveGuess(index: NameIndex, text: string): Guess {
  const q = normName(text);
  if (q.length < 2) return { status: "none" };
  const single = !q.includes(" ");
  const qFlat = q.replace(/ /g, "");
  const max = Math.max(slipsAllowed(qFlat.length), 0);
  const qSound = soundKey(q);
  const qSorted = q.split(" ").sort().join(" ");
  const hits: { e: IndexEntry; d: number }[] = [];
  for (const e of index) {
    const d = slips(e, q, qFlat, qSound, qSorted, single, max);
    if (d <= max) hits.push({ e, d });
  }
  if (!hits.length) return { status: "none" };
  const fame = (e: IndexEntry) => e.f ?? 0;
  const exact = hits.filter((h) => h.d === 0).map((h) => h.e);
  const near = hits.filter((h) => h.d > 0).sort((a, b) => a.d * SLIP_COST - fame(a.e) - (b.d * SLIP_COST - fame(b.e)));
  if (exact.length) {
    const top = Math.max(...exact.map(fame));
    const star = near.find((h) => h.d === 1);
    if (star && top < OBSCURE && fame(star.e) - top >= FAMOUS_SLIP) return { status: "found", entry: star.e, corrected: true };
    const e = famous(exact);
    return e ? { status: "found", entry: e, corrected: false } : { status: "ambiguous" };
  }
  const [best, next] = near;
  // Too close to call between two near-misses: it's probably not a name at all
  if (next && next.d * SLIP_COST - fame(next.e) - (best.d * SLIP_COST - fame(best.e)) < CLOSE_CALL) return { status: "none" };
  return { status: "found", entry: best.e, corrected: true };
}
