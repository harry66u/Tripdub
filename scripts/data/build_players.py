"""Build the Starting Five player pool from Basketball-Reference season tables.

Input:  .data-cache/bbref/*.csv   (run scripts/data/fetch.py first)
Output: src/data/sf-players.json  (list of SFPlayer, see src/games/starting-five/types.ts)

Method (also explained on the About page):
- Only NBA seasons. Traded players use their combined-season row.
- A season "qualifies" at >= 1000 minutes (>= 700 in the shortened 1999, 2012, 2020, 2021 seasons).
- Every stat is turned into a z-score against that season's qualified players, so each player is
  measured against his own era. Stats the league didn't track yet fall back to the closest
  available signal (no blocks/steals before 1973-74, no threes before 1979-80).
- Each entry is one season of one player (a "version", e.g. 2016 Stephen Curry): his best
  2-4 seasons by Win Shares and honors. Old-timers make the pool only if they're famous.
- Ratings are percentile ranks within the pool of versions, 1..99.
"""
import collections
import csv
import glob
import io
import json
import math
import os
import re
import unicodedata
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, ".data-cache", "bbref")
OUT = os.path.join(ROOT, "src", "data", "sf-players.json")
SHORT_SEASONS = {1999, 2012, 2020, 2021}
SLOT_ORDER = ["PG", "SG", "SF", "PF", "C"]


def num(x):
    if x is None or x in ("NA", ""):
        return None
    try:
        return float(x)
    except ValueError:
        return None


def load(name):
    with open(os.path.join(SRC, name + ".csv"), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def one_row_per_season(rows):
    """(player_id, season) -> row, preferring the combined-teams row for traded players."""
    groups = collections.defaultdict(list)
    for r in rows:
        if r["lg"] == "NBA":
            groups[(r["player_id"], int(r["season"]))].append(r)
    out = {}
    for key, g in groups.items():
        combined = [r for r in g if re.fullmatch(r"\dTM|TOT", r["team"])]
        out[key] = combined[0] if combined else max(g, key=lambda r: num(r.get("mp")) or 0)
    return out


def mean_sd(values):
    vals = [v for v in values if v is not None]
    if len(vals) < 8:
        return None
    m = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - m) ** 2 for v in vals) / len(vals))
    return (m, sd) if sd > 1e-9 else None


def clip(x, lo, hi):
    return max(lo, min(hi, x))


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def nba_ids():
    """bbref id -> NBA.com person id (crosswalk), plus name -> ids from NBA.com shot data for newer players."""
    cross = {}
    path = os.path.join(ROOT, ".data-cache", "ids", "nba_ids.csv")
    with open(path, encoding="latin-1") as f:
        for r in csv.DictReader(f):
            if r["BBRefID"] and r["NBAID"].isdigit():
                cross[r["BBRefID"]] = int(r["NBAID"])
    by_name = collections.defaultdict(set)
    for z in sorted(glob.glob(os.path.join(ROOT, ".data-cache", "shots", "*.zip"))):
        with zipfile.ZipFile(z) as zf:
            name = next(n for n in zf.namelist() if n.endswith(".csv") and not n.startswith("__"))
            seen = set()
            with zf.open(name) as f:
                for row in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
                    key = (row["PLAYER_ID"], row["PLAYER_NAME"])
                    if key not in seen:
                        seen.add(key)
                        by_name[name_key(row["PLAYER_NAME"])].add(int(row["PLAYER_ID"]))
    return cross, by_name


def name_key(s):
    return re.sub(r"[^a-z0-9]+", " ", strip_accents(s).lower()).strip()


def main():
    cross_ids, shot_ids = nba_ids()
    totals = one_row_per_season(load("Player Totals"))
    adv = one_row_per_season(load("Advanced"))
    shooting = one_row_per_season(load("Player Shooting"))
    career = {r["player_id"]: r for r in load("Player Career Info")}
    team_sum = load("Team Summaries")

    league_pace = {}
    by_season = collections.defaultdict(list)
    for r in team_sum:
        if r["lg"] == "NBA" and r["team"] != "League Average" and num(r["pace"]):
            by_season[int(r["season"])].append(num(r["pace"]))
    for s, v in by_season.items():
        league_pace[s] = sum(v) / len(v)

    seasons_all = sorted({s for (_, s) in totals})
    latest_complete = max(s for s in seasons_all if sum(1 for (_, ss) in totals if ss == s) > 300 and
                          sum((num(totals[k]["mp"]) or 0) >= 1000 for k in totals if k[1] == s) > 100)

    # ---------- per-season metrics for qualified seasons ----------
    season_metrics = {}  # (pid, season) -> dict
    for key, t in totals.items():
        pid, season = key
        mp = num(t["mp"])
        if mp is None:
            continue
        if mp < (700 if season in SHORT_SEASONS else 1000):
            continue
        a = adv.get(key, {})
        sh = shooting.get(key)
        h = num(career.get(pid, {}).get("ht_in_in"))
        g = lambda col: num(t.get(col))
        ga = lambda col: num(a.get(col))
        per36 = lambda v: None if v is None else v / mp * 36
        fg3a, fg3, fta, ft = g("x3pa"), g("x3p"), g("fta"), g("ft")
        m = {
            "mp": mp,
            "ws": ga("ws") or 0.0,
            "height": h,
            "pts36": per36(g("pts")),
            "ast36": per36(g("ast")),
            "trb36": per36(g("trb")),
            "fga36": per36(g("fga")),
            "fta36": per36(fta),
            "ts": ga("ts_percent"),
            "astp": ga("ast_percent"),
            "tovp": ga("tov_percent"),
            "trbp": ga("trb_percent"),
            "orbp": ga("orb_percent"),
            "stlp": ga("stl_percent"),
            "blkp": ga("blk_percent"),
            "dbpm": ga("dbpm"),
            "bpm": ga("bpm"),
            "per": ga("per"),
            "ws48": ga("ws_48"),
            "dws48": None if ga("dws") is None else ga("dws") / mp * 48,
            "usgp": ga("usg_percent"),
            "fg3a36": per36(fg3a) if season >= 1980 else None,
            # Shrink 3P% toward a low prior: players who rarely shoot threes are not secret shooters.
            "fg3p": ((fg3 or 0) + 0.28 * 60) / ((fg3a or 0) + 60) if season >= 1980 else None,
            "ftp": None if fta is None else ((ft or 0) + 0.70 * 50) / (fta + 50),
            "rim_share": num(sh.get("percent_fga_from_x0_3_range")) if sh else None,
            "three_share": num(sh.get("percent_fga_from_x3p_range")) if sh else None,
            "x3p_ar": ga("x3p_ar") if season >= 1980 else 0.0,
            "pos": t.get("pos") if t.get("pos") not in (None, "NA", "") else None,
        }
        season_metrics[key] = m

    # ---------- season z-scores ----------
    z_fields = ["height", "pts36", "ast36", "trb36", "ts", "astp", "tovp", "trbp", "orbp", "stlp", "blkp",
                "dbpm", "bpm", "per", "ws48", "dws48", "fg3a36", "fg3p", "ftp"]
    stats = {}
    per_season_keys = collections.defaultdict(list)
    for key in season_metrics:
        per_season_keys[key[1]].append(key)
    for season, keys in per_season_keys.items():
        for f in z_fields:
            stats[(season, f)] = mean_sd(season_metrics[k][f] for k in keys)

    def z(key, f):
        v = season_metrics[key][f]
        ms = stats.get((key[1], f))
        if v is None or ms is None:
            return None
        return clip((v - ms[0]) / ms[1], -3.0, 4.0)

    def season_raw(key):
        zz = lambda f: z(key, f)
        zh = zz("height") or 0.0
        # Scoring: volume and efficiency vs. peers
        sco = 0.6 * (zz("pts36") or 0) + 0.4 * (zz("ts") or 0)
        # Playmaking
        if zz("astp") is not None:
            ply = 0.6 * zz("astp") + 0.4 * (zz("ast36") or 0)
        else:
            ply = zz("ast36") or 0
        if zz("tovp") is not None:
            ply -= 0.15 * zz("tovp")
        # Rebounding
        if zz("orbp") is not None and zz("trbp") is not None:
            reb = 0.7 * zz("trbp") + 0.3 * zz("orbp")
        elif zz("trbp") is not None:
            reb = zz("trbp")
        else:
            reb = zz("trb36") or 0
        # Perimeter defense and rim protection
        dws = zz("dws48") or 0
        if zz("stlp") is not None:
            per = 0.6 * zz("stlp") + 0.2 * (zz("dbpm") or 0) + 0.2 * dws - 0.15 * zh
            rim = 0.6 * (zz("blkp") or 0) + 0.2 * (zz("dbpm") or 0) + 0.2 * zh
        else:
            per = 0.7 * dws - 0.25 * zh
            rim = 0.45 * zh + 0.35 * dws + 0.2 * (zz("trb36") or 0)
        # Shooting / spacing
        if zz("fg3a36") is not None:
            # Volume is capped: in the early 3PT era a couple of attempts a game was a huge z-score.
            spc = 0.35 * min(zz("fg3a36"), 2.5) + 0.4 * (zz("fg3p") or 0) + 0.25 * (zz("ftp") or 0)
        else:
            spc = 0.6 * (zz("ftp") or 0)
        # Overall impact
        if zz("bpm") is not None:
            ovr = 0.5 * (zz("ws48") or 0) + 0.5 * zz("bpm")
        else:
            ovr = 0.6 * (zz("ws48") or 0) + 0.4 * (zz("per") or 0)
        return {"sco": sco, "ply": ply, "reb": reb, "per": per, "rim": rim, "spc": spc, "ovr": ovr}

    # ---------- accolades, per season and career ----------
    allstar_s = collections.defaultdict(set)
    allnba_s = collections.defaultdict(dict)
    alldef_s = collections.defaultdict(dict)
    mvp_s = collections.defaultdict(set)
    dpoy_s = collections.defaultdict(set)
    for r in load("All-Star Selections"):
        if r["lg"] == "NBA":
            allstar_s[r["player_id"]].add(int(r["season"]))
    for r in load("End of Season Teams"):
        if r["lg"] != "NBA":
            continue
        if r["type"] == "All-NBA":
            allnba_s[r["player_id"]][int(r["season"])] = r["number_tm"]
        elif r["type"] == "All-Defense":
            alldef_s[r["player_id"]][int(r["season"])] = r["number_tm"]
    for r in load("Player Award Shares"):
        if r["winner"] == "TRUE":
            if r["award"] == "nba mvp":
                mvp_s[r["player_id"]].add(int(r["season"]))
            elif r["award"] == "nba dpoy":
                dpoy_s[r["player_id"]].add(int(r["season"]))

    # Team for each season: the team a traded player played the most games for.
    team_names = {}
    for r in load("Team Abbrev"):
        if r["lg"] == "NBA":
            team_names[(int(r["season"]), r["abbreviation"])] = r["team"]
    season_team = {}
    for r in load("Player Totals"):
        if r["lg"] != "NBA" or re.fullmatch(r"\dTM|TOT", r["team"]):
            continue
        key = (r["player_id"], int(r["season"]))
        g = num(r["g"]) or 0
        if key not in season_team or g > season_team[key][1]:
            season_team[key] = (r["team"], g)

    # ---------- which players, and which versions of them ----------
    by_player = collections.defaultdict(list)
    for key in season_metrics:
        by_player[key[0]].append(key)
    career_ws = collections.defaultdict(float)
    for key, a in adv.items():
        career_ws[key[0]] += num(a.get("ws")) or 0.0

    def famous_enough(pid, keys):
        """Old-timers only if they're household names; the modern game gets a much wider net."""
        hof = career.get(pid, {}).get("hof") == "TRUE"
        n_as, n_nba, n_mvp = len(allstar_s[pid]), len(allnba_s[pid]), len(mvp_s[pid])
        peak = max(keys, key=lambda k: season_metrics[k]["ws"])[1]
        if peak < 1980:
            return n_mvp >= 1 or n_nba >= 4
        if peak < 2000:
            return hof or n_nba >= 1 or n_as >= 2
        return n_as >= 1 or n_nba >= 1 or len(alldef_s[pid]) >= 1 or career_ws[pid] >= 45 or (
            career_ws[pid] >= 25 and peak >= latest_complete - 7)

    versions = []  # (pid, key, raw)
    for pid, keys in by_player.items():
        if len(keys) < 2 or not famous_enough(pid, keys):
            continue
        best_ws = max(season_metrics[k]["ws"] for k in keys)

        def fame(k, pid=pid):
            s_ = k[1]
            return (season_metrics[k]["ws"] + 3 * (s_ in allstar_s[pid]) + 2 * (s_ in allnba_s[pid])
                    + 4 * (s_ in mvp_s[pid]))

        n_as = len(allstar_s[pid])
        old_school = len(mvp_s[pid]) >= 1 or len(allnba_s[pid]) >= 4
        cap = 4 if (n_as >= 5 or mvp_s[pid]) else 3 if n_as >= 1 else 2
        good = [k for k in keys if season_metrics[k]["ws"] >= 0.55 * best_ws]
        # Seasons before 1980 only for household names, and at most two of them.
        modern = [k for k in good if k[1] >= 1980]
        vintage = sorted([k for k in good if k[1] < 1980], key=fame, reverse=True)[:2] if old_school else []
        good = modern + vintage
        if not good:
            continue
        for k in sorted(good, key=fame, reverse=True)[:cap]:
            raw = season_raw(k)
            s_ = k[1]
            bonus = {"1st": 0.8, "2nd": 0.5}.get(alldef_s[pid].get(s_), 0) + (0.6 if s_ in dpoy_s[pid] else 0)
            raw["per"] += bonus
            raw["rim"] += 0.4 * bonus
            raw["ovr"] += (0.5 * (s_ in allstar_s[pid]) + {"1st": 0.8, "2nd": 0.5, "3rd": 0.35}.get(allnba_s[pid].get(s_), 0)
                           + 1.0 * (s_ in mvp_s[pid]))
            versions.append((pid, k, raw))

    from bisect import bisect_left, bisect_right

    def pct_map(field):
        vals = sorted(v[2][field] for v in versions)
        n = len(vals)
        out = {}
        for pid, k, raw in versions:
            lo = bisect_left(vals, raw[field])
            hi = bisect_right(vals, raw[field]) - 1
            out[k] = int(round(1 + 98 * ((lo + hi) / 2) / (n - 1)))
        return out

    rating = {f: pct_map(f) for f in ["sco", "ply", "reb", "per", "rim", "spc", "ovr"]}

    def tier_for(ovr_rating):
        if ovr_rating >= 91:
            return "legend"
        if ovr_rating >= 70:
            return "allstar"
        if ovr_rating >= 30:
            return "starter"
        return "role"

    POS_FALLBACK = {"G": "SG", "F": "SF", "C": "C", "G-F": "SG/SF", "F-G": "SG/SF", "F-C": "PF/C", "C-F": "PF/C"}
    out_versions = []
    for pid, k, raw in versions:
        c = career.get(pid, {})
        t = totals[k]
        m = season_metrics[k]
        g = num(t["g"]) or 1
        pg = lambda col: None if num(t.get(col)) is None else round(num(t[col]) / g, 1)
        fga, fta, ft, pts = (num(t[c_]) or 0 for c_ in ("fga", "fta", "ft", "pts"))
        fg3a = num(t["x3pa"]) if k[1] >= 1980 else None
        fg3 = num(t["x3p"]) or 0
        line = {
            "pts": pg("pts"),
            "reb": pg("trb"),
            "ast": pg("ast"),
            "stl": pg("stl"),
            "blk": pg("blk"),
            "fg3Pct": round(fg3 / fg3a, 3) if fg3a and fg3a >= 25 else None,
            "fg3a": round(fg3a / g, 1) if fg3a and fg3a >= 25 else None,
            "ftPct": round(ft / fta, 3) if fta >= 25 else None,
            "tsPct": round(pts / (2 * (fga + 0.44 * fta)), 3) if fga else None,
        }
        height = num(c.get("ht_in_in")) or 78
        if m["rim_share"] is not None:
            rim, three = m["rim_share"], m["three_share"] or 0
        else:
            three = m["x3p_ar"] or 0
            rim = clip(0.25 + (height - 78) * 0.03, 0.1, 0.6) * (1 - three)
        rim, three = round(rim, 3), round(three, 3)
        if m["usgp"]:
            usg = m["usgp"] / 100
        else:
            pace = league_pace.get(k[1], 100.0)
            usg = ((m["fga36"] or 0) + 0.44 * (m["fta36"] or 0) + 2.5) / (pace * 0.75)
        abbr = season_team.get(k, (t["team"], 0))[0]
        nba_id = cross_ids.get(pid)
        name = c.get("player") or t["player"]
        if nba_id is None:
            found = shot_ids.get(name_key(name), set())
            nba_id = next(iter(found)) if len(found) == 1 else None
        s_ = k[1]
        out_versions.append({
            "id": f"{pid}-{s_}",
            "pid": pid,
            "nbaId": nba_id,
            "name": name,
            "season": s_,
            "team": {"abbr": abbr, "name": team_names.get((s_, abbr), abbr)},
            "pos": m["pos"] or POS_FALLBACK.get(c.get("pos", ""), "SF"),
            "heightIn": int(height),
            "tier": tier_for(rating["ovr"][k]),
            "ovr": rating["ovr"][k],
            "era": int((s_ - 1) // 10 * 10),
            "line": line,
            "r": {f: rating[f][k] for f in ["sco", "ply", "reb", "per", "rim", "spc"]},
            "shot": {"rim": rim, "mid": round(1 - rim - three, 3), "three": three},
            "usg": round(clip(usg, 0.08, 0.45), 3),
            "acc": {
                "mvp": s_ in mvp_s[pid],
                "dpoy": s_ in dpoy_s[pid],
                "allStar": s_ in allstar_s[pid],
                "allNba": allnba_s[pid].get(s_),
                "allDef": alldef_s[pid].get(s_),
                "hof": c.get("hof") == "TRUE",
            },
            "career": {"allStar": len(allstar_s[pid]), "allNba": len(allnba_s[pid]), "mvp": len(mvp_s[pid])},
        })

    # Two different players with one name: add the debut year so they stay distinct.
    pids_by_name = collections.defaultdict(set)
    for v in out_versions:
        pids_by_name[v["name"]].add(v["pid"])
    for v in out_versions:
        if len(pids_by_name[v["name"]]) > 1:
            v["name"] = f"{v['name']} ({career.get(v['pid'], {}).get('from', '?')})"
    out_versions.sort(key=lambda v: (-v["ovr"], strip_accents(v["name"]), v["season"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out_versions, f, ensure_ascii=False, separators=(",", ":"))
    tiers = collections.Counter(v["tier"] for v in out_versions)
    eras = collections.Counter(v["era"] for v in out_versions)
    missing = sorted({v["name"] for v in out_versions if v["nbaId"] is None})
    if missing:
        print(f"warning: no NBA.com id for {len(missing)} players: {', '.join(missing[:20])}")
    print(f"wrote {len(out_versions)} versions of {len({v['pid'] for v in out_versions})} players "
          f"(latest complete season {latest_complete}); tiers {dict(tiers)}; eras {dict(sorted(eras.items()))}")


if __name__ == "__main__":
    main()
