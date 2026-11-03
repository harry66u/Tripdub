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

export type IndexEntry = DCName & { keys: string[]; words: string[][] };
export type NameIndex = IndexEntry[];

/** Names as listed (most famous first). Labels like "Patrick Ewing (1985–2002)" match on the name alone. */
export function buildIndex(names: DCName[]): NameIndex {
  return names.map((e) => {
    const base = [e.n.replace(/\s*\(.*\)\s*$/, ""), ...(e.a ?? [])].map(normName).filter(Boolean);
    // "Jaren Jackson Jr." also answers to "Jaren Jackson"
    const keys = [...new Set(base.flatMap((k) => [k, k.replace(/ (jr|sr|ii|iii|iv)$/, "")]))];
    return { ...e, keys, words: keys.map((k) => k.split(" ")) };
  });
}

/** How far ahead in fame the best match must be before a shared name is taken to mean them. */
export const FAME_GAP = 15;

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

const allowance = (len: number) => (len >= 14 ? 3 : len >= 9 ? 2 : len >= 5 ? 1 : 0);

/**
 * Who a typed answer means. Exact names and aliases first; then a lone first or last name
 * ("Kobe", "Curry") when one player is far more famous than anyone else with it; then the
 * closest spelling, allowing a typo or two. Validity for the prompt never sways the choice.
 */
export function resolveGuess(index: NameIndex, text: string): Guess {
  const q = normName(text);
  if (q.length < 2) return { status: "none" };
  const decide = (cands: IndexEntry[], corrected: boolean): Guess | null => {
    if (!cands.length) return null;
    const e = famous(cands);
    return e ? { status: "found", entry: e, corrected } : { status: "ambiguous" };
  };
  const exact = decide(index.filter((e) => e.keys.includes(q)), false);
  if (exact) return exact;
  const single = !q.includes(" ");
  if (single) {
    const byWord = decide(index.filter((e) => e.words.some((w) => w.length > 1 && (w[0] === q || w[w.length - 1] === q))), false);
    if (byWord) return byWord;
  }
  const max = allowance(q.length);
  if (!max) return { status: "none" };
  let best = max + 1;
  let near: IndexEntry[] = [];
  for (const e of index) {
    let d = max + 1;
    for (let k = 0; k < e.keys.length; k++) {
      d = Math.min(d, editDistance(q, e.keys[k], max));
      if (single) {
        const w = e.words[k];
        if (w.length > 1) d = Math.min(d, editDistance(q, w[0], max), editDistance(q, w[w.length - 1], max));
      }
    }
    if (d < best) {
      best = d;
      near = [e];
    } else if (d === best && d <= max) near.push(e);
  }
  return (best <= max && decide(near, true)) || { status: "none" };
}
