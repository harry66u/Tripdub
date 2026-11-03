"""Build the Starting Five player pool from Basketball-Reference season tables.

Input:  .data-cache/bbref/*.csv   (run scripts/data/fetch.py first)
Output: src/data/sf-players.json  (list of SFPlayer, see src/games/starting-five/types.ts)

Method (also explained on the About page):
- Only NBA seasons. Traded players use their combined-season row.
- A season "qualifies" at >= 1000 minutes (>= 700 in the shortened 1999, 2012, 2020, 2021 seasons).
- Every stat is turned into a z-score against that season's qualified players, so each player is
  measured against his own era. Stats the league didn't track yet fall back to the closest
  available signal (no blocks/steals before 1973-74, no threes before 1979-80).
- A player's prime = his best (up to 5) qualified seasons by Win Shares, minutes-weighted.
- Ratings are percentile ranks within the pool, 1..99.
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
PRIME_SEASONS = 5
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

    # ---------- accolades ----------
    acc = collections.defaultdict(lambda: {"mvp": 0, "allStar": 0, "allNba": 0, "allDef": 0, "dpoy": 0})
    alldef_seasons = collections.defaultdict(dict)
    for r in load("All-Star Selections"):
        if r["lg"] == "NBA":
            acc[r["player_id"]]["allStar"] += 1
    for r in load("End of Season Teams"):
        if r["lg"] != "NBA":
            continue
        if r["type"] == "All-NBA":
            acc[r["player_id"]]["allNba"] += 1
        elif r["type"] == "All-Defense":
            acc[r["player_id"]]["allDef"] += 1
            alldef_seasons[r["player_id"]][int(r["season"])] = 0.8 if r["number_tm"] == "1st" else 0.5
    for r in load("Player Award Shares"):
        if r["winner"] == "TRUE":
            if r["award"] == "nba mvp":
                acc[r["player_id"]]["mvp"] += 1
            elif r["award"] == "nba dpoy":
                acc[r["player_id"]]["dpoy"] += 1

    # ---------- per-player aggregation ----------
    by_player = collections.defaultdict(list)
    for key in season_metrics:
        by_player[key[0]].append(key)

    career_ws = collections.defaultdict(float)
    for key, a in adv.items():
        career_ws[key[0]] += num(a.get("ws")) or 0.0

    candidates = []
    for pid, keys in by_player.items():
        if len(keys) < 3:
            continue
        a = acc[pid]
        recent = any(s >= latest_complete - 7 for (_, s) in keys)
        if not (a["allStar"] or a["allNba"] or a["allDef"] or career_ws[pid] >= 60 or
                (career_ws[pid] >= 35 and recent)):
            continue
        prime = sorted(keys, key=lambda k: season_metrics[k]["ws"], reverse=True)[:PRIME_SEASONS]
        prime.sort(key=lambda k: k[1])
        w = [season_metrics[k]["mp"] for k in prime]
        wsum = sum(w)
        raws = [season_raw(k) for k in prime]
        agg = {f: sum(r[f] * wi for r, wi in zip(raws, w)) / wsum for f in raws[0]}
        # All-Defense recognition during the prime
        bonus = sum(alldef_seasons[pid].get(k[1], 0) for k in prime) / len(prime)
        agg["per"] += bonus
        agg["rim"] += 0.4 * bonus
        agg["ovr"] += 0.06 * min(a["allStar"], 15) + 0.12 * min(a["mvp"], 4) + 0.04 * min(a["allNba"], 15)
        candidates.append((pid, prime, agg))

    def pct_map(field):
        vals = sorted(c[2][field] for c in candidates)
        n = len(vals)
        out = {}
        for pid, _, agg in candidates:
            # average rank for ties
            lo = bisect_left(vals, agg[field])
            hi = bisect_right(vals, agg[field]) - 1
            out[pid] = int(round(1 + 98 * ((lo + hi) / 2) / (n - 1)))
        return out

    from bisect import bisect_left, bisect_right

    rating = {f: pct_map(f) for f in ["sco", "ply", "reb", "per", "rim", "spc", "ovr"]}

    def tier_for(ovr_rating):
        if ovr_rating >= 91:
            return "legend"
        if ovr_rating >= 70:
            return "allstar"
        if ovr_rating >= 30:
            return "starter"
        return "role"

    players = []
    for pid, prime, agg in candidates:
        c = career.get(pid, {})
        t_rows = [totals[k] for k in prime]
        g_sum = sum(num(r["g"]) or 0 for r in t_rows)

        def per_game(col, rows=t_rows):
            vals = [(num(r[col]), num(r["g"]) or 0) for r in rows]
            vals = [(v, gg) for v, gg in vals if v is not None]
            gg = sum(x[1] for x in vals)
            return round(sum(x[0] for x in vals) / gg, 1) if gg else None

        fga = sum(num(r["fga"]) or 0 for r in t_rows)
        fta = sum(num(r["fta"]) or 0 for r in t_rows)
        ft = sum(num(r["ft"]) or 0 for r in t_rows)
        pts = sum(num(r["pts"]) or 0 for r in t_rows)
        three_rows = [r for r in t_rows if int(r["season"]) >= 1980 and num(r["x3pa"]) is not None]
        fg3a_tot = sum(num(r["x3pa"]) for r in three_rows)
        fg3_tot = sum(num(r["x3p"]) or 0 for r in three_rows)
        g3 = sum(num(r["g"]) or 0 for r in three_rows)
        line = {
            "pts": per_game("pts"),
            "reb": per_game("trb"),
            "ast": per_game("ast"),
            "stl": per_game("stl"),
            "blk": per_game("blk"),
            "fg3Pct": round(fg3_tot / fg3a_tot, 3) if fg3a_tot >= 50 else None,
            "fg3a": round(fg3a_tot / g3, 1) if g3 and fg3a_tot >= 50 else None,
            "ftPct": round(ft / fta, 3) if fta >= 50 else None,
            "tsPct": round(pts / (2 * (fga + 0.44 * fta)), 3) if fga else None,
        }
        # Position: minutes-weighted mode over prime seasons
        pos_minutes = collections.Counter()
        for k in prime:
            p = season_metrics[k]["pos"]
            if p:
                pos_minutes[p] += season_metrics[k]["mp"]
        if pos_minutes:
            ranked = pos_minutes.most_common()
            pos = ranked[0][0]
            if len(ranked) > 1 and ranked[1][1] >= 0.3 * sum(pos_minutes.values()):
                pair = sorted([ranked[0][0], ranked[1][0]], key=SLOT_ORDER.index)
                pos = "/".join(pair)
        else:
            pos = {"G": "SG", "F": "SF", "C": "C", "G-F": "SG/SF", "F-G": "SG/SF", "F-C": "PF/C",
                   "C-F": "PF/C"}.get(c.get("pos", ""), "SF")
        # Shot profile
        prof = [(season_metrics[k]["rim_share"], season_metrics[k]["three_share"], season_metrics[k]["mp"])
                for k in prime if season_metrics[k]["rim_share"] is not None]
        height = num(c.get("ht_in_in")) or 78
        if prof:
            wsum = sum(p[2] for p in prof)
            rim = sum(p[0] * p[2] for p in prof) / wsum
            three = sum((p[1] or 0) * p[2] for p in prof) / wsum
        else:
            mpw = sum(season_metrics[k]["mp"] for k in prime)
            three = sum((season_metrics[k]["x3p_ar"] or 0) * season_metrics[k]["mp"] for k in prime) / mpw
            rim = clip(0.25 + (height - 78) * 0.03, 0.1, 0.6) * (1 - three)
        rim, three = round(rim, 3), round(three, 3)
        mid = round(1 - rim - three, 3)
        # Usage
        usg_vals = [(season_metrics[k]["usgp"], season_metrics[k]["mp"]) for k in prime if season_metrics[k]["usgp"]]
        if usg_vals:
            usg = sum(u * m for u, m in usg_vals) / sum(m for _, m in usg_vals) / 100
        else:
            est = []
            for k in prime:
                m = season_metrics[k]
                pace = league_pace.get(k[1], 100.0)
                est.append(((m["fga36"] or 0) + 0.44 * (m["fta36"] or 0) + 2.5) / (pace * 0.75))
            usg = sum(est) / len(est)
        seasons = [k[1] for k in prime]
        mid_start = (min(seasons) + max(seasons)) / 2 - 1
        a = acc[pid]
        nba_id = cross_ids.get(pid)
        if nba_id is None:
            found = shot_ids.get(name_key(c.get("player") or t_rows[0]["player"]), set())
            nba_id = next(iter(found)) if len(found) == 1 else None
        players.append({
            "id": pid,
            "nbaId": nba_id,
            "name": c.get("player") or t_rows[0]["player"],
            "pos": pos,
            "heightIn": int(height),
            "prime": {"from": min(seasons), "to": max(seasons)},
            "tier": tier_for(rating["ovr"][pid]),
            "ovr": rating["ovr"][pid],
            "era": int(mid_start // 10 * 10),
            "line": line,
            "r": {f: rating[f][pid] for f in ["sco", "ply", "reb", "per", "rim", "spc"]},
            "shot": {"rim": rim, "mid": mid, "three": three},
            "usg": round(clip(usg, 0.08, 0.45), 3),
            "acc": {**a, "hof": c.get("hof") == "TRUE"},
        })

    # Disambiguate duplicate display names with the prime span.
    names = collections.Counter(p["name"] for p in players)
    for p in players:
        if names[p["name"]] > 1:
            p["name"] = f"{p['name']} ({p['prime']['from'] - 1}–{str(p['prime']['to'])[2:]})"
    players.sort(key=lambda p: (-p["ovr"], strip_accents(p["name"])))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False, separators=(",", ":"))
    tiers = collections.Counter(p["tier"] for p in players)
    missing = [p["name"] for p in players if p["nbaId"] is None]
    if missing:
        print(f"warning: no NBA.com id for {len(missing)} players: {', '.join(missing[:20])}")
    print(f"wrote {len(players)} players to {os.path.relpath(OUT, ROOT)} "
          f"(latest complete season {latest_complete}); tiers {dict(tiers)}")


if __name__ == "__main__":
    main()
