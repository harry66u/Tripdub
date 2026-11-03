import { franchiseId } from "@/games/starting-five/teams";

/** NBA.com kept team-and-season headshots for recent seasons only. */
export const FIRST_SEASON_PHOTO = 2015;

export type PhotoSubject = {
  nbaId: number | null;
  season?: number;
  team?: { abbr: string; name: string };
};

export function latestHeadshot(nbaId: number, size: "lg" | "sm"): string {
  return `https://cdn.nba.com/headshots/nba/latest/${size === "lg" ? "1040x760" : "260x190"}/${nbaId}.png`;
}

/**
 * Photo URLs to try in order: that season's team headshot first (so 2016 Curry looks like 2016
 * Curry), then the player's latest headshot.
 */
export function headshotCandidates(p: PhotoSubject, size: "lg" | "sm"): string[] {
  if (p.nbaId == null) return [];
  const out: string[] = [];
  const team = p.team ? franchiseId(p.team.name) : null;
  if (p.season && p.season >= FIRST_SEASON_PHOTO && team) {
    const year = p.season - 1; // NBA.com files a season under its start year
    out.push(`https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/${team}/${year}/260x190/${p.nbaId}.png`);
    out.push(`https://cdn.nba.com/headshots/nba/${team}/${year}/${size === "lg" ? "1040x760" : "260x190"}/${p.nbaId}.png`);
  }
  out.push(latestHeadshot(p.nbaId, size));
  return out;
}
