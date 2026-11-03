/**
 * Team presentation: NBA.com logo ids for current franchise names, and jersey colors for every
 * team name in the pool (including relocated and renamed ones). A historical name that differs
 * from today's (e.g. Seattle SuperSonics) gets no logo, since today's would be the wrong one.
 */

const NBA_TEAM_IDS: Record<string, number> = {
  "Atlanta Hawks": 1610612737,
  "Boston Celtics": 1610612738,
  "Brooklyn Nets": 1610612751,
  "Charlotte Hornets": 1610612766,
  "Chicago Bulls": 1610612741,
  "Cleveland Cavaliers": 1610612739,
  "Dallas Mavericks": 1610612742,
  "Denver Nuggets": 1610612743,
  "Detroit Pistons": 1610612765,
  "Golden State Warriors": 1610612744,
  "Houston Rockets": 1610612745,
  "Indiana Pacers": 1610612754,
  "Los Angeles Clippers": 1610612746,
  "Los Angeles Lakers": 1610612747,
  "Memphis Grizzlies": 1610612763,
  "Miami Heat": 1610612748,
  "Milwaukee Bucks": 1610612749,
  "Minnesota Timberwolves": 1610612750,
  "New Orleans Pelicans": 1610612740,
  "New York Knicks": 1610612752,
  "Oklahoma City Thunder": 1610612760,
  "Orlando Magic": 1610612753,
  "Philadelphia 76ers": 1610612755,
  "Phoenix Suns": 1610612756,
  "Portland Trail Blazers": 1610612757,
  "Sacramento Kings": 1610612758,
  "San Antonio Spurs": 1610612759,
  "Toronto Raptors": 1610612761,
  "Utah Jazz": 1610612762,
  "Washington Wizards": 1610612764,
};

/** [jersey, trim] */
const COLORS: Record<string, [string, string]> = {
  "Atlanta Hawks": ["#C8102E", "#FDB927"],
  "St. Louis Hawks": ["#0C2340", "#C8102E"],
  "Boston Celtics": ["#007A33", "#FFFFFF"],
  "Brooklyn Nets": ["#111111", "#FFFFFF"],
  "New Jersey Nets": ["#002A60", "#CD1041"],
  "Charlotte Hornets": ["#00788C", "#1D1160"],
  "Charlotte Bobcats": ["#F26532", "#0C2340"],
  "Chicago Bulls": ["#CE1141", "#111111"],
  "Cleveland Cavaliers": ["#860038", "#FDBB30"],
  "Dallas Mavericks": ["#00538C", "#B8C4CA"],
  "Denver Nuggets": ["#0E2240", "#FEC524"],
  "Detroit Pistons": ["#C8102E", "#1D42BA"],
  "Golden State Warriors": ["#1D428A", "#FFC72C"],
  "Philadelphia Warriors": ["#1D428A", "#FFC72C"],
  "San Francisco Warriors": ["#1D428A", "#FFC72C"],
  "Houston Rockets": ["#CE1141", "#111111"],
  "Indiana Pacers": ["#002D62", "#FDBB30"],
  "Los Angeles Clippers": ["#C8102E", "#1D428A"],
  "Buffalo Braves": ["#0E3386", "#E87722"],
  "Los Angeles Lakers": ["#552583", "#FDB927"],
  "Minneapolis Lakers": ["#1D428A", "#FFFFFF"],
  "Memphis Grizzlies": ["#5D76A9", "#12173F"],
  "Vancouver Grizzlies": ["#00A2A3", "#BC7844"],
  "Miami Heat": ["#98002E", "#F9A01B"],
  "Milwaukee Bucks": ["#00471B", "#EEE1C6"],
  "Minnesota Timberwolves": ["#0C2340", "#78BE20"],
  "New Orleans Pelicans": ["#0C2340", "#C8102E"],
  "New Orleans Hornets": ["#00788C", "#1D1160"],
  "New Orleans Jazz": ["#5B2B82", "#F3B21B"],
  "New York Knicks": ["#006BB6", "#F58426"],
  "Oklahoma City Thunder": ["#007AC1", "#EF3B24"],
  "Seattle SuperSonics": ["#00653A", "#FFC200"],
  "Orlando Magic": ["#0077C0", "#C4CED4"],
  "Philadelphia 76ers": ["#006BB6", "#ED174C"],
  "Syracuse Nationals": ["#C8102E", "#0C2340"],
  "Phoenix Suns": ["#1D1160", "#E56020"],
  "Portland Trail Blazers": ["#E03A3E", "#111111"],
  "Sacramento Kings": ["#5A2D81", "#63727A"],
  "Kansas City Kings": ["#003DA5", "#C8102E"],
  "Kansas City-Omaha Kings": ["#003DA5", "#C8102E"],
  "Cincinnati Royals": ["#1D428A", "#C8102E"],
  "Rochester Royals": ["#1D428A", "#C8102E"],
  "San Antonio Spurs": ["#111111", "#C4CED4"],
  "Toronto Raptors": ["#CE1141", "#111111"],
  "Utah Jazz": ["#002B5C", "#F9A01B"],
  "Washington Wizards": ["#002B5C", "#E31837"],
  "Washington Bullets": ["#E31837", "#002B5C"],
  "Baltimore Bullets": ["#E31837", "#002B5C"],
};

export function teamLogoUrl(teamName: string): string | null {
  const id = NBA_TEAM_IDS[teamName];
  return id ? `https://cdn.nba.com/logos/nba/${id}/primary/L/logo.svg` : null;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function teamColors(teamName: string): { jersey: string; trim: string; text: string } {
  const [jersey, trim] = COLORS[teamName] ?? ["#1B3963", "#9BC7EE"];
  return { jersey, trim, text: luminance(jersey) > 0.35 ? "#1B3963" : "#FFFFFF" };
}
