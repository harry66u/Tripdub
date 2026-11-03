import type { SFPlayer } from "../types";

/**
 * How well `a` scores on `d`: his shot diet, each shot type against the defense that guards it
 * (rim protection at the rim, perimeter D on jumpers), scaled by how much he shoots.
 */
function attack(a: SFPlayer, d: SFPlayer): number {
  const v =
    a.shot.rim * (a.r.sco - 0.8 * d.r.rim) + a.shot.mid * (a.r.sco - 0.8 * d.r.per) + a.shot.three * (a.r.spc - 0.6 * d.r.per);
  return v * (a.usg / 0.2);
}

export type Edge = {
  /** Positive: `mine` wins the matchup. Roughly points-per-game-ish scale. */
  net: number;
  label: string;
  side: "you" | "them" | "even";
};

export function matchupEdge(mine: SFPlayer, theirs: SFPlayer): Edge {
  const net = (attack(mine, theirs) - attack(theirs, mine)) / 5;
  if (Math.abs(net) < 3) return { net, label: "Even", side: "even" };
  const big = Math.abs(net) >= 10;
  return net > 0
    ? { net, label: big ? "Big edge: you" : "Edge: you", side: "you" }
    : { net, label: big ? "Big edge: them" : "Edge: them", side: "them" };
}
