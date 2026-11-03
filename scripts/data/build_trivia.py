"""Build the NBA trivia bank from Basketball-Reference season tables.

Every question is generated from the data, so answers are right by construction, and the wrong
options are real contenders (the other MVP finalists, the next three scorers, and so on).

Input:  .data-cache/bbref/*.csv   (scripts/data/fetch.py)
Output: src/data/trivia.json  [{id, q, a: [correct, wrong, wrong, wrong], cat, diff}]
"""
import collections
import csv
import hashlib
import json
import os
import random
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, ".data-cache", "bbref")
OUT = os.path.join(ROOT, "src", "data", "trivia.json")
rand = random.Random(20261103)


def load(name):
    with open(os.path.join(SRC, name + ".csv"), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def label(season):
    return f"{season - 1}–{str(season)[2:]}"


questions = []
seen_text = set()


def add(q, correct, wrong, cat, diff):
    wrong = [w for w in dict.fromkeys(wrong) if w and w != correct][:3]
    key = q + "|" + "|".join(sorted([correct, *wrong]))
    if len(wrong) < 3 or key in seen_text:
        return
    seen_text.add(key)
    qid = "n" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]
    questions.append({"id": qid, "q": q, "a": [correct, *wrong], "cat": cat, "diff": diff})


def main():
    # ---------- shared tables ----------
    totals_rows = [r for r in load("Player Totals") if r["lg"] == "NBA"]
    season_rows = collections.defaultdict(list)
    for r in totals_rows:
        season_rows[(r["player_id"], int(r["season"]))].append(r)
    # one row per player-season: the combined row for traded players
    combined = {}
    for k, rows in season_rows.items():
        tot = [r for r in rows if re.fullmatch(r"\dTM|TOT", r["team"])]
        combined[k] = tot[0] if tot else rows[0]
    names = {r["player_id"]: r["player"] for r in totals_rows}
    career = {r["player_id"]: r for r in load("Player Career Info")}
    for pid, c in career.items():
        names.setdefault(pid, c["player"])
    latest = max(s for (_, s) in combined)

    allstar = collections.defaultdict(set)
    for r in load("All-Star Selections"):
        if r["lg"] == "NBA":
            allstar[r["player_id"]].add(int(r["season"]))
    team_names = {}
    for r in load("Team Abbrev"):
        if r["lg"] == "NBA":
            team_names[(int(r["season"]), r["abbreviation"])] = r["team"]

    # ---------- 1. awards ----------
    awards = collections.defaultdict(list)  # (award, season) -> [(share, pid, winner)]
    for r in load("Player Award Shares"):
        if r["player_id"] in names:
            awards[(r["award"], int(r["season"]))].append((num(r["share"]) or 0, r["player_id"], r["winner"] == "TRUE"))
    award_text = {
        "nba mvp": ("MVP", 1980, lambda s: "easy" if s >= 1995 else "medium" if s >= 1985 else "hard"),
        "nba roy": ("Rookie of the Year", 1980, lambda s: "medium" if s >= 2003 else "hard"),
        "nba dpoy": ("Defensive Player of the Year", 1983, lambda s: "medium" if s >= 2010 else "hard"),
        "nba smoy": ("Sixth Man of the Year", 1983, lambda s: "hard"),
        "nba mip": ("Most Improved Player", 1988, lambda s: "hard"),
    }
    for (award, season), rows in awards.items():
        if award not in award_text:
            continue
        title, first, diff = award_text[award]
        if season < first:
            continue
        winners = [pid for _, pid, w in rows if w]
        if len(winners) != 1:
            continue
        others = [pid for _, pid, w in sorted(rows, reverse=True) if not w]
        add(
            f"Who won {title} for the {label(season)} season?" if award != "nba mvp" else f"Who was named MVP for the {label(season)} season?",
            names[winners[0]],
            [names[p] for p in others],
            "Awards",
            diff(season),
        )

    # ---------- 2. per-game stat leaders (only when the leader is unambiguous) ----------
    stats = {"pts": ("points", 1980), "trb": ("rebounds", 1980), "ast": ("assists", 1980), "blk": ("blocks", 1980), "stl": ("steals", 1980)}
    by_season = collections.defaultdict(list)
    for (pid, season), r in combined.items():
        by_season[season].append((pid, r))
    for season, rows in by_season.items():
        if season >= latest or season < 1980:
            continue
        max_g = max(num(r["g"]) or 0 for _, r in rows)
        for col, (word, first) in stats.items():
            leaders = []
            for floor in (50, 58, 65, 0.7 * max_g):
                pool = [(num(r[col]) / num(r["g"]), pid) for pid, r in rows if num(r["g"]) and num(r["g"]) >= floor and num(r[col]) is not None]
                pool.sort(reverse=True)
                leaders.append(pool)
            tops = {p[0][1] for p in leaders if p}
            pool = leaders[1]
            if len(tops) != 1 or len(pool) < 4 or pool[0][0] - pool[1][0] < 0.15:
                continue
            diff = ("easy" if season >= 2000 else "medium" if season >= 1990 else "hard") if col == "pts" else ("medium" if season >= 2005 else "hard")
            add(
                f"Who led the NBA in {word} per game in {label(season)}?",
                names[pool[0][1]],
                [names[p] for _, p in pool[1:6]],
                "Stat leaders",
                diff,
            )

    # ---------- 3. which team (stars only, single-team seasons) ----------
    teams_by_season = collections.defaultdict(set)
    for r in totals_rows:
        if not re.fullmatch(r"\dTM|TOT", r["team"]):
            teams_by_season[int(r["season"])].add(r["team"])
    player_teams = collections.defaultdict(set)
    for (pid, season), rows in season_rows.items():
        for r in rows:
            if not re.fullmatch(r"\dTM|TOT", r["team"]):
                player_teams[pid].add(team_names.get((season, r["team"]), r["team"]))
    team_qs = []
    for (pid, season), rows in season_rows.items():
        if season < 1985 or season not in allstar[pid] or len(rows) != 1:
            continue
        abbr = rows[0]["team"]
        team = team_names.get((season, abbr))
        if not team or len(player_teams[pid]) < 2:
            continue
        others = [t for t in player_teams[pid] if t != team]
        pool = [team_names.get((season, a)) for a in sorted(teams_by_season[season]) if team_names.get((season, a)) not in (team, None)]
        rand.shuffle(pool)
        n_as = len(allstar[pid])
        diff = "easy" if n_as >= 5 and season >= 2005 else "medium" if n_as >= 3 and season >= 1995 else "hard"
        team_qs.append((n_as, f"Which team did {names[pid]} play for in {label(season)}?", team, others + pool, diff))
    # Keep it varied: at most two seasons per player.
    per_player = collections.Counter()
    for n_as, q, team, wrong, diff in sorted(team_qs, key=lambda x: (-x[0], x[1])):
        who = q.split(" play for")[0]
        if per_player[who] >= 3:
            continue
        per_player[who] += 1
        add(q, team, wrong, "Teams", diff)

    # ---------- 4. college ----------
    famous = [pid for pid in allstar if len(allstar[pid]) >= 3 and pid in career]
    colleges = {}
    for pid in famous:
        c = career[pid]
        if c["colleges"] in ("", "NA") or "," in c["colleges"] or int(c["to"] or 0) < 1985:
            continue
        colleges[pid] = c["colleges"].strip()
    popular = [c for c, _ in collections.Counter(colleges.values()).most_common(40)]
    for pid, college in sorted(colleges.items()):
        wrong = [c for c in popular if c != college]
        rand.shuffle(wrong)
        n_as = len(allstar[pid])
        diff = "easy" if n_as >= 6 else "medium" if n_as >= 4 else "hard"
        add(f"Which college did {names[pid]} play at?", college, wrong, "College", diff)

    # ---------- 5. best record ----------
    standings = collections.defaultdict(list)
    for r in load("Team Summaries"):
        if r["lg"] == "NBA" and r["team"] != "League Average" and num(r["w"]) is not None:
            s = int(r["season"])
            w, l = num(r["w"]), num(r["l"])
            standings[s].append((w / (w + l), r["team"].replace("*", "").strip()))
    for season, rows in standings.items():
        if season < 1980 or season >= latest:
            continue
        rows.sort(reverse=True)
        if len(rows) < 4 or rows[0][0] == rows[1][0]:
            continue
        diff = "medium" if season >= 2008 else "hard"
        add(f"Which team had the best regular-season record in {label(season)}?", rows[0][1], [t for _, t in rows[1:5]], "Standings", diff)

    # ---------- 6. scoring averages in famous seasons ----------
    mvp_seasons = {(pid, s) for (aw, s), rows in awards.items() if aw == "nba mvp" for _, pid, w in rows if w}
    for (pid, season) in sorted(mvp_seasons):
        r = combined.get((pid, season))
        if not r or season < 1985 or not num(r["g"]):
            continue
        ppg = round(num(r["pts"]) / num(r["g"]), 1)
        offsets = rand.sample([-5.2, -3.6, -2.1, 1.9, 3.4, 4.8], 3)
        wrong = [f"{ppg + o:.1f}" for o in offsets]
        add(f"How many points per game did {names[pid]} average in his {label(season)} MVP season?", f"{ppg:.1f}", wrong, "Numbers", "hard")

    # ---------- 7. most All-Star selections ----------
    stars = sorted([pid for pid in allstar if len(allstar[pid]) >= 3 and max(allstar[pid]) >= 1990], key=lambda p: -len(allstar[p]))
    made = 0
    attempts = 0
    while made < 220 and attempts < 5000:
        attempts += 1
        group = rand.sample(stars, 4)
        counts = sorted((len(allstar[p]) for p in group), reverse=True)
        if counts[0] - counts[1] < 2:
            continue
        group.sort(key=lambda p: -len(allstar[p]))
        gap = counts[0] - counts[1]
        before = len(questions)
        add("Which of these players made the most NBA All-Star teams?", names[group[0]], [names[p] for p in group[1:]], "All-Stars",
            "easy" if gap >= 6 else "medium" if gap >= 3 else "hard")
        made += len(questions) > before

    # ---------- 8. team leading scorers ----------
    team_season = collections.defaultdict(list)
    for (pid, season), rows in season_rows.items():
        for r in rows:
            if re.fullmatch(r"\dTM|TOT", r["team"]) or not num(r["g"]) or num(r["g"]) < 50 or num(r["pts"]) is None:
                continue
            team_season[(season, r["team"])].append((num(r["pts"]) / num(r["g"]), pid))
    for (season, abbr), rows in sorted(team_season.items()):
        team = team_names.get((season, abbr))
        if season < 1990 or season >= latest or not team or len(rows) < 4:
            continue
        rows.sort(reverse=True)
        (top, pid), (second, _) = rows[0], rows[1]
        if top < 18 or top - second < 1.0:
            continue
        star = season in allstar[pid]
        diff = "easy" if star and season >= 2008 else "medium" if star or season >= 2008 else "hard"
        add(f"Who led the {team} in scoring in {label(season)}?", names[pid], [names[p] for _, p in rows[1:4]], "Teams", diff)

    # ---------- 9. career points ----------
    career_pts = collections.Counter()
    for (pid, season), r in combined.items():
        career_pts[pid] += num(r["pts"]) or 0
    scorers = [pid for pid in stars if career_pts[pid] >= 12000]
    made = attempts = 0
    while made < 220 and attempts < 6000:
        attempts += 1
        group = rand.sample(scorers, 4)
        pts = sorted((career_pts[p] for p in group), reverse=True)
        if pts[0] - pts[1] < 1500:
            continue
        group.sort(key=lambda p: -career_pts[p])
        gap = pts[0] - pts[1]
        before = len(questions)
        add("Which of these players scored the most career NBA regular-season points?", names[group[0]], [names[p] for p in group[1:]],
            "Numbers", "easy" if gap >= 9000 else "medium" if gap >= 4000 else "hard")
        made += len(questions) > before

    questions.sort(key=lambda x: x["id"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, separators=(",", ":"))
    mix = collections.Counter(q["diff"] for q in questions)
    cats = collections.Counter(q["cat"] for q in questions)
    print(f"wrote {len(questions)} NBA questions to {os.path.relpath(OUT, ROOT)} {dict(mix)} {dict(cats)}")


if __name__ == "__main__":
    main()
