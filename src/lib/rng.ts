/** sfc32: small, fast, deterministic PRNG. Same seed -> same sequence on client and server. */
export function rng(seed: number): () => number {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const out = (t + d) | 0;
    c = (c + out) | 0;
    return (out >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

/** 32-bit FNV-1a over the joined parts. */
export function hashSeed(...parts: (string | number)[]): number {
  const s = parts.join("␟");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick an index with probability proportional to weight. */
export function weightedIndex(weights: number[], r: () => number): number {
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  let x = r() * total;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    if (x < w) return i;
    x -= w;
  }
  return weights.length - 1;
}

export function shuffle<T>(items: readonly T[], r: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
