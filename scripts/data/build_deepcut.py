"""Build Deep Cut: NBA prompts with every valid answer computed from real data, plus tiers.

Validity comes only from Basketball-Reference tables (rosters, draft, awards, season and career
stats, colleges, height). Tiers come from a fame score (All-Stars, All-NBA, MVPs, Hall of Fame,
career points, seasons, #1 pick, recency) adjusted by content/deep-cut/fame.json (an AI-written
read on casual-fan fame), then hand curation in content/deep-cut/curation.json (Too Cute and
Half-Court picks, per-answer tier overrides, disabled prompts, added/removed answers) and fully
custom prompts in content/deep-cut/custom-prompts.json.

Outputs (server-side only):
  src/data/deepcut-prompts.json  [{id, text, kind, answers: {pid: tier}, ease}]
  src/data/deepcut-names.json    [{i: pid, n: name, y: "1996–2016"}]   (autocomplete list)
"""
import collections
import csv
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, ".data-cache", "bbref")
CONTENT = os.path.join(ROOT, "content", "deep-cut")
OUT_PROMPTS = os.path.join(ROOT, "src", "data", "deepcut-prompts.json")
OUT_NAMES = os.path.join(ROOT, "src", "data", "deepcut-names.json")
TIERS = ["layup", "toocute", "midrange", "three", "logo", "halfcourt"]

FRANCHISE = {
    "Atlanta Hawks": ["St. Louis Hawks", "Milwaukee Hawks", "Tri-Cities Blackhawks"],
    "Boston Celtics": [],
    "Brooklyn Nets": ["New Jersey Nets", "New York Nets"],
    "Charlotte Hornets": ["Charlotte Bobcats"],
    "Chicago Bulls": [],
    "Cleveland Cavaliers": [],
    "Dallas Mavericks": [],
    "Denver Nuggets": [],
    "Detroit Pistons": ["Fort Wayne Pistons"],
    "Golden State Warriors": ["Philadelphia Warriors", "San Francisco Warriors"],
    "Houston Rockets": ["San Diego Rockets"],
    "Indiana Pacers": [],
    "Los Angeles Clippers": ["San Diego Clippers", "Buffalo Braves"],
    "Los Angeles Lakers": ["Minneapolis Lakers"],
    "Memphis Grizzlies": ["Vancouver Grizzlies"],
    "Miami Heat": [],
    "Milwaukee Bucks": [],
    "Minnesota Timberwolves": [],
    "New Orleans Pelicans": ["New Orleans Hornets", "New Orleans/Oklahoma City Hornets"],
    "New York Knicks": [],
    "Oklahoma City Thunder": ["Seattle SuperSonics"],
    "Orlando Magic": [],
    "Philadelphia 76ers": ["Syracuse Nationals"],
    "Phoenix Suns": [],
    "Portland Trail Blazers": [],
    "Sacramento Kings": ["Kansas City Kings", "Kansas City-Omaha Kings", "Cincinnati Royals", "Rochester Royals"],
    "San Antonio Spurs": [],
    "Toronto Raptors": [],
    "Utah Jazz": ["New Orleans Jazz"],
    "Washington Wizards": ["Washington Bullets", "Capital Bullets", "Baltimore Bullets", "Chicago Zephyrs", "Chicago Packers"],
}
NICK = {f: f.split(" ")[-1] if f != "Portland Trail Blazers" else "Trail Blazers" for f in FRANCHISE}
NICK["Philadelphia 76ers"] = "76ers"
TEAMMATE_STARS = [
    "jordami01", "bryanko01", "jamesle01", "duncati01", "onealsh01", "curryst01", "nowitdi01", "garneke01",
    "iversal01", "nashst01", "wadedw01", "duranke01", "hardeja01", "antetgi01", "jokicni01", "johnsma02",
    "birdla01", "abdulka01", "olajuha01", "barklch01", "malonka01", "stockjo01", "pippesc01", "ewingpa01",
    "robinda01", "piercpa01", "allenra02", "anthoca01", "paulch01", "howardw01", "westbru01", "leonaka01",
    "doncilu01", "tatumja01", "irvinky01", "lillada01", "davisan02", "georgpa01", "embiijo01", "butleji01",
]
COLLEGES = ["Duke", "Kentucky", "UNC", "UCLA", "Kansas", "Michigan State", "Arizona", "Syracuse", "Georgetown", "Indiana",
            "Villanova", "Michigan", "Texas", "Florida", "UConn", "LSU", "Ohio State", "Wake Forest", "Louisville", "Gonzaga",
            "Notre Dame", "St. John's", "Illinois", "Tennessee", "NC State", "USC", "Marquette", "Maryland", "Memphis", "Arkansas",
            "Houston", "UNLV", "Purdue", "Alabama", "Georgia Tech", "Stanford", "Virginia", "Cincinnati", "Oklahoma", "Baylor"]
BOTH = [("Los Angeles Lakers", "Boston Celtics"), ("Chicago Bulls", "New York Knicks"), ("Miami Heat", "Cleveland Cavaliers"),
        ("Los Angeles Lakers", "Los Angeles Clippers"), ("Golden State Warriors", "Houston Rockets"), ("San Antonio Spurs", "Dallas Mavericks"),
        ("Boston Celtics", "Brooklyn Nets"), ("Phoenix Suns", "Los Angeles Lakers"), ("Detroit Pistons", "Chicago Bulls"),
        ("Oklahoma City Thunder", "Golden State Warriors"), ("Philadelphia 76ers", "Boston Celtics"), ("Miami Heat", "New York Knicks"),
        ("Utah Jazz", "Houston Rockets"), ("Toronto Raptors", "San Antonio Spurs"), ("Milwaukee Bucks", "Denver Nuggets")]


def load(name):
    with open(os.path.join(SRC, name + ".csv"), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def read_json(name, default):
    p = os.path.join(CONTENT, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()).strip()


def main():
    totals = [r for r in load("Player Totals") if r["lg"] == "NBA"]
    career = {r["player_id"]: r for r in load("Player Career Info")}
    team_name = {(int(r["season"]), r["abbreviation"]): r["team"] for r in load("Team Abbrev") if r["lg"] == "NBA"}
    to_franchise = {}
    for f, olds in FRANCHISE.items():
        for n in [f, *olds]:
            to_franchise[n] = f
    latest = max(int(r["season"]) for r in totals)

    # Per player: seasons, teams, totals
    seasons = collections.defaultdict(set)
    team_rows = collections.defaultdict(set)  # pid -> {(season, abbr)}
    season_combined = {}
    for r in totals:
        pid, s = r["player_id"], int(r["season"])
        seasons[pid].add(s)
        if re.fullmatch(r"\dTM|TOT", r["team"]):
            season_combined[(pid, s)] = r
        else:
            team_rows[pid].add((s, r["team"]))
            season_combined.setdefault((pid, s), r)
    franchises = collections.defaultdict(set)
    for pid, rows in team_rows.items():
        for s, abbr in rows:
            f = to_franchise.get(team_name.get((s, abbr), ""))
            if f:
                franchises[pid].add(f)
    car = collections.defaultdict(collections.Counter)
    for (pid, s), r in season_combined.items():
        for col in ("pts", "trb", "ast", "x3p", "g"):
            car[pid][col] += num(r[col]) or 0

    allstar = collections.Counter(r["player_id"] for r in load("All-Star Selections") if r["lg"] == "NBA")
    eos = load("End of Season Teams")
    allnba = collections.Counter(r["player_id"] for r in eos if r["lg"] == "NBA" and r["type"] == "All-NBA")
    allnba1 = {r["player_id"] for r in eos if r["lg"] == "NBA" and r["type"] == "All-NBA" and r["number_tm"] == "1st"}
    alldef1 = {r["player_id"] for r in eos if r["lg"] == "NBA" and r["type"] == "All-Defense" and r["number_tm"] == "1st"}
    # A few award rows lack a player id; recover them from the name and that season's rosters.
    by_season_name = collections.defaultdict(list)
    for r in totals:
        by_season_name[(int(r["season"]), r["player"])].append(r["player_id"])
    awards = load("Player Award Shares")
    for r in awards:
        if r["player_id"] in ("", "NA"):
            ids = set(by_season_name.get((int(r["season"]), r["player"]), []))
            if len(ids) == 1:
                r["player_id"] = ids.pop()
    winners = collections.defaultdict(set)
    for r in awards:
        if r["winner"] == "TRUE":
            winners[r["award"]].add(r["player_id"])
    draft = [r for r in load("Draft Pick History") if r["lg"] == "NBA"]
    pick = collections.defaultdict(lambda: 99)
    for r in draft:
        if r["overall_pick"].isdigit():
            pick[r["player_id"]] = min(pick[r["player_id"]], int(r["overall_pick"]))

    # Universe: everyone with an NBA season, named as on Basketball-Reference
    universe = sorted(seasons)
    names = {pid: career.get(pid, {}).get("player") or next(r["player"] for r in totals if r["player_id"] == pid) for pid in universe}
    dup = collections.Counter(names.values())

    # ---------- fame: how well-known each player is to a casual fan, 0-100 ----------
    mvp_count = collections.Counter(r["player_id"] for r in awards if r["award"] == "nba mvp" and r["winner"] == "TRUE")
    allnba1_count = collections.Counter(r["player_id"] for r in eos if r["lg"] == "NBA" and r["type"] == "All-NBA" and r["number_tm"] == "1st")
    by_name = collections.defaultdict(list)
    for pid in universe:
        by_name[norm(names[pid])].append(pid)
    for pid, alts in read_json("aliases.json", {}).items():
        if not pid.startswith("_"):
            for a in alts:
                by_name[norm(a)].append(pid)
    fame_adj = {}
    for k, v in read_json("fame.json", {}).items():
        if k.startswith("_"):
            continue
        hits = [k] if k in seasons else by_name.get(norm(k), [])
        if len(hits) == 1:
            fame_adj[hits[0]] = v
        else:
            print(f'warning: fame.json "{k}" is {"ambiguous, use the Basketball-Reference id" if hits else "not an NBA player"}')
    fame = {}
    for pid in universe:
        last = max(seasons[pid])
        era = 1.0 if last >= 2015 else 0.92 if last >= 2005 else 0.82 if last >= 1995 else 0.68 if last >= 1985 else 0.5 if last >= 1975 else 0.38
        f = (30 * min(allstar[pid], 12) / 12 + 15 * min(allnba[pid], 8) / 8 + 15 * (mvp_count[pid] > 0) + 5 * min(mvp_count[pid], 4) / 4
             + 6 * (career.get(pid, {}).get("hof") == "TRUE") + 8 * min(car[pid]["pts"], 25000) / 25000 + 6 * min(len(seasons[pid]), 15) / 15
             + 3 * (pick[pid] == 1) + 5 * (allnba1_count[pid] > 0) + 2 * (pid in winners["nba roy"]))
        fame[pid] = max(0.0, min(100.0, f * era + fame_adj.get(pid, 0)))

    # How much each player meant to each franchise: seasons there, weighted up for All-Star seasons
    as_season = {(r["player_id"], int(r["season"])) for r in load("All-Star Selections") if r["lg"] == "NBA"}
    win_pct = {}
    for r in load("Team Summaries"):
        w, l = num(r["w"]), num(r["l"])
        if r["lg"] == "NBA" and w is not None and l and (w + l):
            win_pct[(int(r["season"]), r["abbreviation"])] = w / (w + l)
    stint = collections.defaultdict(float)  # (pid, franchise, season) -> value
    for r in totals:
        if re.fullmatch(r"\dTM|TOT", r["team"]):
            continue
        pid, s_ = r["player_id"], int(r["season"])
        f = to_franchise.get(team_name.get((s_, r["team"]), ""))
        if f:
            great = win_pct.get((s_, r["team"]), 0) >= 0.7  # memorable teams make their role players memorable
            stint[(pid, f, s_)] += min(1.0, (num(r["g"]) or 0) / 70) * (1 + 2 * ((pid, s_) in as_season) + 1.5 * great)
    team_value = collections.defaultdict(float)
    for (pid, f, s_), v in stint.items():
        team_value[(pid, f)] += v

    prompts = []

    def prompt(pid_, text, kind, fam, valid, note="", metric=None, power=0.6, blend=0.0, tags=()):
        """metric: how strongly each valid player fits the prompt (more = more likely to be named).
        Score = fame x (metric / max)^power, or, with blend w, fame x (1 - w) + 100 x w x (metric / max)."""
        valid = {p for p in valid if p in fame}
        if len(valid) < 8:
            return
        score = {}
        top = max((metric.get(p, 0) for p in valid), default=0) if metric else 0
        for p in valid:
            m = (metric.get(p, 0) / top) if metric and top > 0 else 1.0
            score[p] = fame[p] * (1 - blend) + 100 * blend * m if blend else fame[p] * (m ** power if metric else 1.0)
        prompts.append({"id": pid_, "text": text, "kind": kind, "fam": fam, "note": note, "valid": valid, "score": score, "tags": list(tags)})

    # Which old names each franchise actually used in the NBA, for the fine print
    used_names = collections.defaultdict(set)
    for (s_, abbr), n in team_name.items():
        if n in to_franchise:
            used_names[to_franchise[n]].add((s_, n))

    def history_note(*fs):
        parts = []
        for f in fs:
            olds = sorted({n for _, n in used_names[f] if n != f}, key=lambda n: -max(s_ for s_, m in used_names[f] if m == n))
            if olds:
                parts.append(f"{NICK[f]}: includes the {', '.join(olds)}")
        return "Franchise history counts. " + "; ".join(parts) + "." if parts else ""

    slug = lambda x: norm(x).replace(" ", "-")

    # ---------- general: broad, many answers ----------
    for f in FRANCHISE:
        prompt(f"team-{slug(NICK[f])}", f"Name a player who played for the {NICK[f]}", "general", "team",
               {p for p in universe if f in franchises[p]}, history_note(f), {p: team_value[(p, f)] for p in universe}, 0.45, tags=[slug(NICK[f])])
    prompt("pick-1", "Name a former #1 overall pick", "general", "draft", {p for p in universe if pick[p] == 1}, "NBA draft, any year.")
    prompt("top-3", "Name a player drafted in the top 3", "general", "draft", {p for p in universe if pick[p] <= 3}, "NBA draft, any year.")
    award_count = collections.defaultdict(collections.Counter)
    for r in awards:
        if r["winner"] == "TRUE":
            award_count[r["award"]][r["player_id"]] += 1
    prompt("mvp", "Name an NBA MVP", "general", "award", winners["nba mvp"], "Regular-season MVP. ABA awards don't count.", award_count["nba mvp"], 0.15)
    prompt("hof", "Name a Hall of Famer who played in the NBA", "general", "award",
           {p for p in universe if career.get(p, {}).get("hof") == "TRUE"}, "Inducted as a player.")
    prompt("roy", "Name a Rookie of the Year", "general", "award", winners["nba roy"], "NBA Rookie of the Year.")
    prompt("dpoy", "Name a Defensive Player of the Year", "general", "award", winners["nba dpoy"], "Since the award began in 1983.", award_count["nba dpoy"], blend=0.25)
    prompt("all-star", "Name an All-Star", "general", "award", set(allstar), "Any NBA All-Star selection.")
    prompt("all-nba", "Name a player who made an All-NBA team", "general", "award", set(allnba), "First, Second or Third Team.")
    prompt("career-10k", "Name a player with 10,000+ career points", "general", "career",
           {p for p in universe if car[p]["pts"] >= 10000}, "NBA regular season only.")
    prompt("seasons-15", "Name a player who played 15+ NBA seasons", "general", "career", {p for p in universe if len(seasons[p]) >= 15})
    for col in COLLEGES:
        valid = {p for p in universe if col in [c.strip() for c in career.get(p, {}).get("colleges", "").split(",")]}
        prompt(f"college-{slug(col)}", f"Name an NBA player who went to {col}", "general", "college", valid, "Any player who attended, even for one year.")

    roster = collections.defaultdict(set)  # (season, abbr) -> pids
    for pid, rows in team_rows.items():
        for key in rows:
            roster[key].add(pid)
    for star in TEAMMATE_STARS:
        if star not in team_rows:
            print(f"warning: teammate star {star} not found")
            continue
        mates = set()
        for key in team_rows[star]:
            mates |= roster[key]
        mates.discard(star)
        shared = collections.Counter()
        for key in team_rows[star]:
            for m in roster[key]:
                shared[m] += 1
        prompt(f"teammate-{star}", f"Name a teammate of {names[star]}", "general", "teammate", mates,
               "On the same team's roster in the same regular season.", shared, 0.6, tags=[star])

    # Drafted by each franchise (players who reached the NBA)
    drafted = collections.defaultdict(set)
    draft_pick_of = {}
    for r in draft:
        d_season = int(r["season"])
        n = team_name.get((d_season + 1, r["tm"])) or team_name.get((d_season, r["tm"])) or ""
        f = to_franchise.get(n)
        if f and r["player_id"] in seasons:
            drafted[f].add(r["player_id"])
            if r["overall_pick"].isdigit():
                draft_pick_of[(r["player_id"], f)] = int(r["overall_pick"])
    for f in FRANCHISE:
        # Lottery picks and franchise stars are the ones people remember
        m = {p: team_value[(p, f)] + 3 / max(1, draft_pick_of.get((p, f), 30)) for p in drafted[f]}
        prompt(f"drafted-{slug(NICK[f])}", f"Name a player drafted by the {NICK[f]}", "general", "drafted", drafted[f],
               ("Players who reached the NBA. " + history_note(f)).strip(), m, 0.35, tags=[slug(NICK[f])])

    # ---------- specific: stat thresholds and narrower lists ----------
    def season_where(test):
        out = collections.Counter()
        for (pid, s_), r in season_combined.items():
            g = num(r["g"]) or 0
            if g and test(r, g):
                out[pid] += 1
        return out

    pg = lambda r, col, g: (num(r[col]) or 0) / g
    MIN50 = "NBA regular season, min. 50 games."
    specs = [
        ("threes-250", "Name a player who made 250+ threes in a season", lambda r, g: (num(r["x3p"]) or 0) >= 250, "NBA regular season."),
        ("threes-200", "Name a player who made 200+ threes in a season", lambda r, g: (num(r["x3p"]) or 0) >= 200, "NBA regular season."),
        ("ppg-30", "Name a player who averaged 30+ points in a season", lambda r, g: g >= 50 and pg(r, "pts", g) >= 30, MIN50),
        ("ppg-25", "Name a player who averaged 25+ points in a season", lambda r, g: g >= 50 and pg(r, "pts", g) >= 25, MIN50),
        ("apg-10", "Name a player who averaged 10+ assists in a season", lambda r, g: g >= 50 and pg(r, "ast", g) >= 10, MIN50),
        ("rpg-13", "Name a player who averaged 13+ rebounds in a season", lambda r, g: g >= 50 and pg(r, "trb", g) >= 13, MIN50),
        ("blk-200", "Name a player who blocked 200+ shots in a season", lambda r, g: (num(r["blk"]) or 0) >= 200, "NBA regular season, since blocks were first counted in 1973–74."),
        ("stl-175", "Name a player who had 175+ steals in a season", lambda r, g: (num(r["stl"]) or 0) >= 175, "NBA regular season, since steals were first counted in 1973–74."),
        ("triple-double", "Name a player who averaged a triple-double for a season",
         lambda r, g: g >= 50 and min(pg(r, "pts", g), pg(r, "trb", g), pg(r, "ast", g)) >= 10, MIN50),
        ("twenty-ten", "Name a player who averaged 20 and 10 in a season",
         lambda r, g: g >= 50 and pg(r, "pts", g) >= 20 and pg(r, "trb", g) >= 10, "20+ points and 10+ rebounds a game. " + MIN50),
        ("fifty-forty-ninety", "Name a player who shot 50/40/90 in a season",
         lambda r, g: (num(r["fga"]) or 0) >= 300 and (num(r["x3pa"]) or 0) >= 100 and (num(r["fta"]) or 0) >= 100
         and (num(r["fg"]) or 0) / num(r["fga"]) >= 0.5 and (num(r["x3p"]) or 0) / num(r["x3pa"]) >= 0.4 and (num(r["ft"]) or 0) / num(r["fta"]) >= 0.9,
         "50% FG, 40% 3P, 90% FT. Min. 300 field goal, 100 three and 100 free throw attempts."),
        ("pts-2500", "Name a player who scored 2,500+ points in a season", lambda r, g: (num(r["pts"]) or 0) >= 2500, "NBA regular season."),
        ("ppg-20-rookie", "Name a player who averaged 20+ points as a rookie", None, MIN50),
    ]
    first_season = {pid: min(v) for pid, v in seasons.items()}
    for pid_, text, test, note in specs:
        if pid_ == "ppg-20-rookie":
            hits = collections.Counter({pid: 1 for (pid, s_), r in season_combined.items()
                                        if s_ == first_season[pid] and (num(r["g"]) or 0) >= 50 and pg(r, "pts", num(r["g"])) >= 20})
        else:
            hits = season_where(test)
        prompt(pid_, text, "specific", "season", set(hits), note, hits, 0.4)

    stat = lambda col: {p: car[p][col] for p in universe}
    prompt("career-20k", "Name a player with 20,000+ career points", "specific", "career", {p for p in universe if car[p]["pts"] >= 20000}, "NBA regular season only.", stat("pts"), 0.8)
    prompt("career-ast-7k", "Name a player with 7,000+ career assists", "specific", "career", {p for p in universe if car[p]["ast"] >= 7000}, "NBA regular season only.", stat("ast"), 0.8)
    prompt("career-reb-10k", "Name a player with 10,000+ career rebounds", "specific", "career", {p for p in universe if car[p]["trb"] >= 10000}, "NBA regular season only.", stat("trb"), 0.8)
    prompt("career-3s-1500", "Name a player with 1,500+ career threes", "specific", "career", {p for p in universe if car[p]["x3p"] >= 1500}, "NBA regular season only.", stat("x3p"), 1.6)
    prompt("allstar-10", "Name a player who made 10+ All-Star teams", "specific", "career", {p for p in universe if allstar[p] >= 10}, "Selections, not games played.", allstar, 0.5)
    prompt("seasons-18", "Name a player who played 18+ NBA seasons", "specific", "career", {p for p in universe if len(seasons[p]) >= 18}, "", {p: len(seasons[p]) for p in universe}, 0.8)
    prompt("franchises-8", "Name a player who played for 8+ different franchises", "specific", "career", {p for p in universe if len(franchises[p]) >= 8},
           "Renamed or relocated teams count once.")
    prompt("mip", "Name a Most Improved Player winner", "specific", "award", winners["nba mip"])
    prompt("smoy", "Name a Sixth Man of the Year", "specific", "award", winners["nba smoy"], "", award_count["nba smoy"], blend=0.25)
    prompt("all-nba-1", "Name a player who made an All-NBA First Team", "specific", "award", allnba1)
    prompt("all-def-1", "Name a player who made an All-Defensive First Team", "specific", "award", alldef1)
    prompt("pick-2", "Name a former #2 overall pick", "specific", "draft", {p for p in universe if pick[p] == 2}, "NBA draft, any year.")
    ht = {p: num(career.get(p, {}).get("ht_in_in")) or 0 for p in universe}
    prompt("tall", "Name a player listed at 7'2\" or taller", "specific", "body", {p for p in universe if ht[p] >= 86},
           "Listed height on Basketball-Reference.", {p: max(0.0, ht[p] - 85) for p in universe}, blend=0.45)
    prompt("short", "Name a player listed at 5'10\" or shorter", "specific", "body", {p for p in universe if 0 < ht[p] <= 70},
           "Listed height on Basketball-Reference.", {p: max(0.0, 71 - ht[p]) for p in universe if ht[p]}, blend=0.3)

    for f in FRANCHISE:
        for decade in (1980, 1990, 2000, 2010, 2020):
            if decade == 2020 and latest < 2024:
                continue
            valid, used = set(), set()
            for p, rows in team_rows.items():
                for s_, abbr in rows:
                    n = team_name.get((s_, abbr), "")
                    if to_franchise.get(n) == f and decade + 1 <= s_ <= decade + 10:
                        valid.add(p)
                        used.add(n)
            team_seasons = {s_ for (p_, f2, s_) in stint if f2 == f and decade + 1 <= s_ <= decade + 10}
            if len(team_seasons) < 4:  # e.g. the 1980s Magic had one season: not a fair prompt
                continue
            label = next(iter(used)) if len(used) == 1 else f"{NICK[f]}"
            dv = collections.Counter()
            for (p, f2, s_), v in stint.items():
                if f2 == f and decade + 1 <= s_ <= decade + 10:
                    dv[p] += v
            note = f"Any season from {decade}–{str(decade + 1)[2:]} through {decade + 9}–{str(decade + 10)[2:]}."
            if len(used) > 1:
                note += " Counts the " + " and the ".join(sorted(used)) + "."
            prompt(f"team-{slug(NICK[f])}-{decade}s", f"Name a player who played for the {label} in the {decade}s", "specific", "team-decade", valid, note, dv, 0.45, tags=[slug(NICK[f])])
    # Franchise All-Stars and 20-point scorers
    for f in FRANCHISE:
        stars = collections.Counter()
        for (p, f2, s_), v in stint.items():
            if f2 == f and (p, s_) in as_season:
                stars[p] += 1
        prompt(f"allstar-{slug(NICK[f])}", f"Name a player who made an All-Star team as a member of the {NICK[f]}", "specific", "team-allstar",
               set(stars), ("On the team's roster in an All-Star season. " + history_note(f)).strip(), stars, 0.4, tags=[slug(NICK[f])])
        scorers = collections.Counter()
        for r in totals:
            if re.fullmatch(r"\dTM|TOT", r["team"]):
                continue
            s_, g = int(r["season"]), num(r["g"]) or 0
            if g >= 40 and to_franchise.get(team_name.get((s_, r["team"]), "")) == f and (num(r["pts"]) or 0) / g >= 20:
                scorers[r["player_id"]] += 1
        prompt(f"ppg20-{slug(NICK[f])}", f"Name a player who averaged 20+ points in a season for the {NICK[f]}", "specific", "team-scorer",
               set(scorers), ("Regular season with the team, min. 40 games. " + history_note(f)).strip(), scorers, 0.4, tags=[slug(NICK[f])])

    for a, b in BOTH:
        prompt(f"both-{slug(NICK[a])}-{slug(NICK[b])}", f"Name a player who played for both the {NICK[a]} and the {NICK[b]}",
               "specific", "both", {p for p in universe if a in franchises[p] and b in franchises[p]}, history_note(a, b),
               {p: min(team_value[(p, a)], team_value[(p, b)]) for p in universe}, 0.3, tags=[slug(NICK[a]), slug(NICK[b])])

    # ---------- custom prompts and curation ----------

    problems = []

    def resolve(name_or_id, where=""):
        if name_or_id in fame:
            return name_or_id
        hits = sorted(set(by_name.get(norm(name_or_id), [])))
        if len(hits) == 1:
            return hits[0]
        problems.append(f'{where}"{name_or_id}" is ' + (f"ambiguous ({', '.join(hits)}), use the Basketball-Reference id" if hits else "not an NBA player"))
        return None

    for c in read_json("custom-prompts.json", []):
        valid = {resolve(n, f'{c["id"]}: ') for n in c["answers"]} - {None}
        prompts.append({"id": c["id"], "text": c["text"], "kind": c.get("kind", "specific"), "fam": c.get("fam", "custom"),
                        "note": c.get("note", ""), "valid": valid, "score": None, "tags": c.get("tags", [])})
    curation = {k: v for k, v in read_json("curation.json", {}).items() if not k.startswith("_")}
    known_ids = {p["id"] for p in prompts}
    for k in curation:
        if k not in known_ids:
            problems.append(f'curation.json: no prompt with id "{k}"')
    out = []
    for p in prompts:
        cur = curation.get(p["id"], {})
        if cur.get("disabled"):
            continue
        where = f'{p["id"]}: '
        valid = (set(p["valid"]) | {resolve(n, where) for n in cur.get("add", [])}) - {None}
        valid -= {resolve(n, where) for n in cur.get("remove", [])}
        score = p["score"] or {}
        hand = {resolve(n_, "") for key in ("tooCute", "halfCourt") for n_ in cur.get(key, [])} | {resolve(n_, "") for n_ in (cur.get("tiers") or {})}
        # Hand-placed answers sit out the automatic split, so every prompt keeps its share of layups.
        ranked = sorted(valid - hand, key=lambda x: (-score.get(x, fame[x]), -fame[x], names[x]))
        n = len(ranked)
        layups = max(2, min(6, round(n * 0.05)))
        mid_end = layups + max(2, round(n * 0.2))
        three_end = mid_end + max(2, round(n * 0.32))
        tiers = {}
        for i, pid in enumerate(ranked):
            tiers[pid] = "layup" if i < layups else "midrange" if i < mid_end else "three" if i < three_end else "logo"
        for tier_name, key in (("toocute", "tooCute"), ("halfcourt", "halfCourt")):
            for name in cur.get(key, []):
                pid = resolve(name, where)
                if pid is None:
                    continue
                if pid not in valid:
                    problems.append(f'{p["id"]}: {key} "{name}" is not a valid answer')
                    continue
                tiers[pid] = tier_name
        for name, tier in (cur.get("tiers") or {}).items():
            pid = resolve(name, where)
            if pid is None:
                continue
            if pid in valid and tier in TIERS:
                tiers[pid] = tier
            else:
                problems.append(f'{p["id"]}: tier override "{name}" -> {tier} is invalid')
        ease = sum(1 for pid in valid if fame[pid] >= 30)
        text = cur.get("text", p["text"])
        note = cur.get("note", p["note"])
        out.append({"id": p["id"], "text": text, "note": note, "kind": cur.get("kind", p["kind"]), "fam": p["fam"], "tags": p["tags"], "ease": ease,
                    "answers": dict(sorted(tiers.items()))})

    if problems:
        print("Curation problems:\n - " + "\n - ".join(problems))
        if "--strict" in sys.argv:
            sys.exit(1)
    out.sort(key=lambda p: p["id"])
    used = {pid for p in out for pid in p["answers"]}
    name_list = []
    aliases = {k: v for k, v in read_json("aliases.json", {}).items() if not k.startswith("_")}
    dup_years = collections.Counter((names[pid], f"{min(seasons[pid]) - 1}–{max(seasons[pid])}") for pid in universe)
    for pid in universe:
        s = sorted(seasons[pid])
        years = f"{s[0] - 1}–{s[-1]}"
        label = names[pid] if dup[names[pid]] == 1 else f"{names[pid]} ({years})"
        if dup_years[(names[pid], years)] > 1:
            label = f"{names[pid]} ({years}, {pid})"
        entry = {"i": pid, "n": label, "y": years, "f": round(fame[pid])}
        if aliases.get(pid):
            entry["a"] = aliases[pid]
        name_list.append(entry)
    name_list.sort(key=lambda x: (-x["f"], x["n"]))
    json.dump(out, open(OUT_PROMPTS, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(name_list, open(OUT_NAMES, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    kinds = collections.Counter(p["kind"] for p in out)
    print(f"wrote {len(out)} prompts {dict(kinds)}; {len(name_list)} names; {len(used)} players are valid somewhere")


if __name__ == "__main__":
    main()
