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
    const keys = [e.n.replace(/\s*\(.*\)\s*$/, ""), ...(e.a ?? [])].map(normName).filter(Boolean);
    return { ...e, keys, words: keys.map((k) => k.split(" ")) };
  });
}

/** Best matches for what's typed so far. Every typed word must start a word of the name, in order. */
export function search(index: NameIndex, query: string, limit = 6): IndexEntry[] {
  const q = normName(query);
  if (q.length < 2) return [];
  const qw = q.split(" ");
  const ranked: { e: IndexEntry; rank: number; at: number }[] = [];
  index.forEach((e, at) => {
    let best = Infinity;
    e.keys.forEach((key, k) => {
      if (key === q) best = Math.min(best, 0);
      else if (key.startsWith(q)) best = Math.min(best, 1);
      else {
        const words = e.words[k];
        let w = 0;
        for (const part of qw) {
          while (w < words.length && !words[w].startsWith(part)) w++;
          if (w >= words.length) return;
          w++;
        }
        best = Math.min(best, qw.length === 1 && words[words.length - 1].startsWith(q) ? 2 : 3);
      }
    });
    if (best < Infinity) ranked.push({ e, rank: best, at });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.at - b.at);
  return ranked.slice(0, limit).map((r) => r.e);
}

/** The one player whose name (or alias) is exactly this text; null when none or several match. */
export function resolveExact(index: NameIndex, text: string): IndexEntry | null {
  const q = normName(text);
  if (!q) return null;
  const hits = index.filter((e) => e.keys.includes(q));
  return hits.length === 1 ? hits[0] : null;
}
