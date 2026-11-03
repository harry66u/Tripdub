import type { Lineup, RatingKey, SFPlayer } from "@/games/starting-five/types";

let n = 0;
export function fixturePlayer(
  overrides: Partial<Omit<SFPlayer, "r">> & { r?: Partial<Record<RatingKey, number>> } = {},
): SFPlayer {
  n += 1;
  const { r, ...rest } = overrides;
  return {
    id: `fix${n}-2014`,
    pid: `fix${n}`,
    nbaId: null,
    name: `Fixture Player ${n}`,
    season: 2014,
    team: { abbr: "TST", name: "Test City Fixtures" },
    pos: "SF",
    heightIn: 79,
    tier: "starter",
    ovr: 50,
    era: 2010,
    line: { pts: 15, reb: 5, ast: 3, stl: 1, blk: 0.5, fg3Pct: 0.36, fg3a: 3, ftPct: 0.78, tsPct: 0.56 },
    r: { sco: 50, ply: 50, reb: 50, per: 50, rim: 50, spc: 50, ...r },
    shot: { rim: 0.3, mid: 0.4, three: 0.3 },
    usg: 0.2,
    acc: { mvp: false, dpoy: false, allStar: false, allNba: null, allDef: null, hof: false },
    career: { allStar: 0, allNba: 0, mvp: 0 },
    ...rest,
  };
}

export function lineupOf(players: SFPlayer[]): Lineup {
  const [PG, SG, SF, PF, C] = players;
  return { PG, SG, SF, PF, C };
}

export function flatTeam(rating: number, name = "T"): SFPlayer[] {
  return Array.from({ length: 5 }, (_, i) =>
    fixturePlayer({
      name: `${name}${i}`,
      r: { sco: rating, ply: rating, reb: rating, per: rating, rim: rating, spc: rating },
    }),
  );
}
