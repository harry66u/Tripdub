import type { SFPlayer } from "../types";

export type Archetype =
  | "Floor General"
  | "Point Forward"
  | "Point Center"
  | "Sharpshooter"
  | "Slasher"
  | "Two-Way Wing"
  | "Rim Protector"
  | "Glass Cleaner"
  | "Stretch Big"
  | "Bucket Getter"
  | "Post Scorer"
  | "Lockdown Defender";

function isBig(p: SFPlayer): boolean {
  return p.pos.includes("C") || p.pos === "PF" || p.heightIn >= 82;
}

/**
 * A one-phrase read on how a player plays. Every archetype scores how far the player clears
 * its bar; the clearest wins.
 */
export function archetype(p: SFPlayer): Archetype {
  const { sco, ply, reb, per, rim, spc } = p.r;
  const big = isBig(p);
  const guard = p.pos.includes("PG") || p.pos.includes("SG");
  const options: [Archetype, number][] = [
    ["Bucket Getter", sco - 80],
    ["Lockdown Defender", per - 82],
    ["Glass Cleaner", reb - 84],
  ];
  if (guard) options.push(["Floor General", ply - 80]);
  else if (big && p.pos.includes("C")) options.push(["Point Center", ply - 72]);
  else options.push(["Point Forward", ply - 72]);
  if (big) {
    options.push(["Rim Protector", rim - 80], ["Stretch Big", spc - 62], ["Post Scorer", sco - 76]);
  } else {
    options.push(
      ["Sharpshooter", spc - 80],
      ["Two-Way Wing", Math.min(per, sco) - 76],
      ["Slasher", sco - 82 + (p.shot.rim - 0.3) * 50],
    );
  }
  return options.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export type Clue = { era: string; archetype: Archetype };

export function clueFor(p: SFPlayer): Clue {
  return { era: `${p.era}s`, archetype: archetype(p) };
}
