"""Build the Shot Chart pool: one zone shot chart per NBA player-season, 2003-04..2024-25.

LOC_X SIGN CONVENTION (checked on every build, see loc_x_report()): in this mirror "Left Corner 3"
shots have POSITIVE LOC_X (+22..+25 ft) and "Right Corner 3" shots NEGATIVE LOC_X, in 19 of the 22
seasons. Coordinates are in feet: the baseline is y = 0, the hoop is at (0, 5.25) and half court is
y = 47. So when the court is drawn with the hoop at the bottom and x increasing to the right (plotting
LOC_X/LOC_Y as given), the "left" zones go on the RIGHT half of the screen; with the hoop at the top,
they go on the left. Either way that is presumably the shooter's left as he faces the basket (an
inference: the data only fixes the sign). Exception: the 2020, 2021 and 2022 files (2019-20..2021-22)
have LOC_X and LOC_Y 10x too small and LOC_X with the opposite sign ("Left Corner 3" near -2.3 there).
The output never uses LOC_X/LOC_Y: zones come from BASIC_ZONE + ZONE_NAME, whose labels agree in all
seasons, so it is unaffected. Draw zones by their ids, not from raw coordinates.

Inputs (run scripts/data/fetch.py --shots first):
- .data-cache/shots/NBA_{2004..2025}_Shots.csv.zip: every regular-season shot from NBA.com, via
  https://github.com/DomSamangy/NBA_Shots_04_25 (streamed one season at a time).
- .data-cache/bbref/*.csv: Basketball-Reference season tables, via
  https://github.com/sumitrodatta/bball-reference-datasets (NBA rows only): Player Totals for the
  per-game line, position and names; All-Star Selections, End of Season Teams (All-NBA) and Player
  Award Shares (MVP, Sixth Man, Rookie of the Year) for fame; Team Abbrev for team abbreviations.
- .data-cache/ids/nba_ids.csv: Basketball-Reference <-> NBA.com id crosswalk (through 2019-20), via
  https://github.com/djblechn-su/nba-player-team-ids.
Output: src/data/shotcharts.json, compact JSON:
  {version: 1, zones: [12 zone ids], league: {"<season>": {zone: [fgm, fga]}},
   charts: [{id, pid, nbaId, name, season, team: {abbr, name}, pos, fga, fgm, zones: {zone: [fgm, fga]},
             line: {pts, reb, ast}, allStar, fame, tier}]}

Method:
- Zones: ra = Restricted Area; paint = In The Paint (Non-RA); mid_lb/lw/c/rw/rb = Mid-Range by
  ZONE_NAME (Left Side, Left Side Center, Center, Right Side Center, Right Side); c3_l / c3_r = the
  corner threes; atb_l/c/r = Above the Break 3 by ZONE_NAME. Heaves (BASIC_ZONE "Backcourt" or
  ZONE_NAME "Back Court") are dropped everywhere, so a chart's fga/fgm are its shots minus heaves
  and always equal the sum of its zones. League averages per season and zone use every shot.
- Eligible: fga >= 500 (>= 380 in the shortened 2011-12, 2019-20 and 2020-21 seasons).
- Each NBA.com PLAYER_ID is matched to a Basketball-Reference id through the crosswalk when that id
  played in the season, otherwise by normalized name (accents, punctuation and jr/sr/ii/iii
  dropped) among that season's players, using team and FGA to break ties.
- Team: the team he took the most shots for. The line (pts/reb/ast per game) is the bbref
  combined-teams row for traded players.
- Fame (0..100) estimates how recognizable the player-season is to a casual fan: career All-Star
  selections (capped at 15), All-NBA teams, MVPs, career points, Sixth Man / Rookie of the Year
  awards, plus that season's All-Star, All-NBA, MVP and MVP vote share, points per game and a small
  recency bonus. Scaled so the most famous season is 100.
- Tiers by fame rank in the pool: 1 = top 10%, 2 = next 15%, 3 = next 25%, 4 = next 25%, 5 = the
  rest. Anyone who was ever an All-Star is kept out of tier 5 (moved to tier 4), so tier 5 is deep
  cuts: rotation players who never made an All-Star team.

Usage: python3 -I scripts/data/build_shotcharts.py
"""
import collections
import csv
import glob
import io
import json
import os
import re
import unicodedata
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, ".data-cache")
BBREF = os.path.join(CACHE, "bbref")
OUT = os.path.join(ROOT, "src", "data", "shotcharts.json")
SEASONS = range(2004, 2026)
SHORT_SEASONS = {2012, 2020, 2021}
ZONES = ["ra", "paint", "mid_lb", "mid_lw", "mid_c", "mid_rw", "mid_rb", "c3_l", "c3_r", "atb_l", "atb_c", "atb_r"]
MID = {"Left Side": "mid_lb", "Left Side Center": "mid_lw", "Center": "mid_c",
       "Right Side Center": "mid_rw", "Right Side": "mid_rb"}
ATB = {"Left Side": "atb_l", "Left Side Center": "atb_l", "Center": "atb_c",
       "Right Side Center": "atb_r", "Right Side": "atb_r"}
TEAM_ALIASES = {"LA Clippers": "Los Angeles Clippers"}
TIER_CUTS = [0.10, 0.25, 0.50, 0.75]  # cumulative share of the pool in tiers 1..4
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def num(x):
    if x in (None, "", "NA"):
        return None
    try:
        return float(x)
    except ValueError:
        return None


def load(name):
    with open(os.path.join(BBREF, name + ".csv"), encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r.get("lg", "NBA") == "NBA"]


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def name_key(s, drop_suffix=False):
    words = re.sub(r"[^a-z0-9 ]+", "", strip_accents(s).lower().replace("-", " ")).split()
    if drop_suffix:
        words = [w for w in words if w not in SUFFIXES]
    return " ".join(words)


def zone_of(basic, zname):
    """NBA.com BASIC_ZONE + ZONE_NAME -> zone id, or None for backcourt heaves."""
    if basic == "Backcourt" or zname == "Back Court":
        return None
    if basic == "Restricted Area":
        return "ra"
    if basic == "In The Paint (Non-RA)":
        return "paint"
    if basic == "Mid-Range" and zname in MID:
        return MID[zname]
    if basic == "Left Corner 3":
        return "c3_l"
    if basic == "Right Corner 3":
        return "c3_r"
    if basic == "Above the Break 3" and zname in ATB:
        return ATB[zname]
    raise ValueError(f"unknown zone {basic!r} / {zname!r}")


def read_season(year):
    """Stream one season of shots. Returns (players, league, corner LOC_X signs)."""
    path = os.path.join(CACHE, "shots", f"NBA_{year}_Shots.csv.zip")
    players = {}
    league = {z: [0, 0] for z in ZONES}
    signs = collections.Counter()
    with zipfile.ZipFile(path) as zf:
        member = next(n for n in zf.namelist() if n.endswith(".csv") and not n.startswith("__MACOSX"))
        with zf.open(member) as f:
            for row in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
                if int(row["SEASON_1"]) != year:
                    raise ValueError(f"{member}: row from season {row['SEASON_1']}")
                made = {"TRUE": 1, "FALSE": 0}[row["SHOT_MADE"]]
                basic = row["BASIC_ZONE"]
                if basic in ("Left Corner 3", "Right Corner 3"):
                    x = float(row["LOC_X"])
                    signs[(basic, "+" if x > 0 else "-" if x < 0 else "0")] += 1
                    signs["abs_x"] += abs(x)
                z = zone_of(basic, row["ZONE_NAME"])
                if z is None:
                    continue
                league[z][0] += made
                league[z][1] += 1
                pid = int(row["PLAYER_ID"])
                p = players.get(pid)
                if p is None:
                    p = players[pid] = {"zones": {zz: [0, 0] for zz in ZONES}, "team": collections.Counter(),
                                        "pos": collections.Counter(), "name": collections.Counter()}
                p["zones"][z][0] += made
                p["zones"][z][1] += 1
                p["team"][row["TEAM_NAME"]] += 1
                p["name"][row["PLAYER_NAME"]] += 1
                pos = row.get("POSITION")
                if pos and pos != "NA":
                    p["pos"][pos] += 1
    return players, league, signs


def one_row_per_season(rows):
    """(player_id, season) -> row, preferring the combined-teams row for traded players."""
    groups = collections.defaultdict(list)
    for r in rows:
        groups[(r["player_id"], int(r["season"]))].append(r)
    out = {}
    for key, g in groups.items():
        combined = [r for r in g if re.fullmatch(r"\dTM|TOT", r["team"])]
        out[key] = combined[0] if combined else max(g, key=lambda r: num(r.get("mp")) or 0)
    return out


class Matcher:
    """NBA.com PLAYER_ID + season -> Basketball-Reference player id."""

    def __init__(self, totals_rows):
        self.cross = {}
        with open(os.path.join(CACHE, "ids", "nba_ids.csv"), encoding="latin-1") as f:
            for r in csv.DictReader(f):
                if r["NBAID"].isdigit() and r["BBRefID"] not in ("", "NA"):
                    self.cross[int(r["NBAID"])] = r["BBRefID"]
        self.played = set()  # (bbref id, season)
        self.rows = collections.defaultdict(list)  # season -> [(pid, name, team, fga)] team rows only
        for r in totals_rows:
            s = int(r["season"])
            self.played.add((r["player_id"], s))
            if not re.fullmatch(r"\dTM|TOT", r["team"]):
                self.rows[s].append((r["player_id"], r["player"], r["team"], num(r["fga"]) or 0))
        self.how = collections.Counter()

    def match(self, nba_id, season, names, team_abbrs, fga):
        pid = self.cross.get(nba_id)
        if pid and (pid, season) in self.played:
            self.how["crosswalk"] += 1
            return pid
        rows = self.rows.get(season, [])
        for drop in (False, True):
            keys = {name_key(n, drop) for n in names}
            cands = {r[0] for r in rows if name_key(r[1], drop) in keys}
            if len(cands) > 1:  # same name twice in one season: prefer his team, then the closest FGA
                on_team = {r[0] for r in rows if r[0] in cands and r[2] in team_abbrs}
                cands = on_team or cands
            if len(cands) > 1:
                best = {}
                for r in rows:
                    if r[0] in cands:
                        best[r[0]] = best.get(r[0], 0) + r[3]
                cands = {min(best, key=lambda p: abs(best[p] - fga))}
            if cands:
                self.how["name" if not drop else "name without suffix"] += 1
                return cands.pop()
        # Last resort: same team, nearly the same FGA, and one name word in common (nicknames, spellings).
        words = {w for n in names for w in name_key(n, True).split()}
        cands = {r[0] for r in rows if r[2] in team_abbrs and abs(r[3] - fga) <= max(15, 0.05 * fga)
                 and words & set(name_key(r[1], True).split())}
        if len(cands) == 1:
            self.how["team + fga + partial name"] += 1
            return cands.pop()
        self.how["unmatched"] += 1
        return None


def loc_x_report(signs_by_season):
    """Print which sign of LOC_X the 'Left Corner 3' zone has, per season (corner threes sit ~22-25 ft out)."""
    pos, neg, scaled = [], [], []
    for s, signs in sorted(signs_by_season.items()):
        lp, ln = signs[("Left Corner 3", "+")], signs[("Left Corner 3", "-")]
        rp, rn = signs[("Right Corner 3", "+")], signs[("Right Corner 3", "-")]
        if not 20 <= signs["abs_x"] / max(1, lp + ln + rp + rn) <= 26:
            scaled.append(s)
        if lp > 0.99 * (lp + ln) and rn > 0.99 * (rp + rn):
            pos.append(s)
        elif ln > 0.99 * (lp + ln) and rp > 0.99 * (rp + rn):
            neg.append(s)
        else:
            raise ValueError(f"{s}: corner threes on both sides ({dict(signs)})")
    main_sign = "POSITIVE" if len(pos) >= len(neg) else "NEGATIVE"
    other = neg if main_sign == "POSITIVE" else pos
    print(f"LOC_X convention: 'Left Corner 3' shots have {main_sign} LOC_X in {max(len(pos), len(neg))} of "
          f"{len(signs_by_season)} seasons ('Right Corner 3' the opposite); flipped in {other or 'none'}; "
          f"coordinates not in feet in {scaled or 'none'}. "
          f"Zones come from BASIC_ZONE/ZONE_NAME labels, so the output does not depend on it.")


def main():
    totals_rows = load("Player Totals")
    totals = one_row_per_season(totals_rows)
    team_abbr = {(int(r["season"]), r["team"]): r["abbreviation"] for r in load("Team Abbrev")}

    allstar = collections.defaultdict(set)
    for r in load("All-Star Selections"):
        allstar[r["player_id"]].add(int(r["season"]))
    allnba = collections.defaultdict(dict)
    for r in load("End of Season Teams"):
        if r["type"] == "All-NBA":
            allnba[r["player_id"]][int(r["season"])] = r["number_tm"]
    mvp_share = {}
    won = {award: collections.defaultdict(set) for award in ("nba mvp", "nba smoy", "nba roy")}
    for r in load("Player Award Shares"):
        season = int(r["season"])
        if r["award"] == "nba mvp":
            mvp_share[(r["player_id"], season)] = num(r["share"]) or 0.0
        if r["winner"] == "TRUE" and r["award"] in won:
            won[r["award"]][r["player_id"]].add(season)
    mvp, smoy, roy = won["nba mvp"], won["nba smoy"], won["nba roy"]
    career_pts = collections.Counter()
    for (pid, _), r in totals.items():
        career_pts[pid] += num(r["pts"]) or 0

    matcher = Matcher(totals_rows)
    league, charts, signs_by_season = {}, [], {}
    nba_to_pid = {}
    for season in SEASONS:
        players, lg, signs = read_season(season)
        league[str(season)] = lg
        signs_by_season[season] = signs
        min_fga = 380 if season in SHORT_SEASONS else 500
        for nba_id, p in players.items():
            fga = sum(a for _, a in p["zones"].values())
            if fga < min_fga:
                continue
            teams = [TEAM_ALIASES.get(t, t) for t, _ in p["team"].most_common()]
            abbrs = {team_abbr.get((season, t), t[:3].upper()) for t in teams}
            pid = matcher.match(nba_id, season, list(p["name"]), abbrs, fga)
            if pid:
                nba_to_pid.setdefault(nba_id, set()).add(pid)
            charts.append({"nba_id": nba_id, "season": season, "pid": pid, "p": p, "fga": fga, "teams": teams})
        print(f"{season}: {len(players)} shooters, {sum(c['season'] == season for c in charts)} eligible")
    loc_x_report(signs_by_season)

    # One NBA.com id must map to one bbref id; one bbref id must not take two charts in a season.
    for nba_id, pids in nba_to_pid.items():
        if len(pids) > 1:
            raise ValueError(f"NBA id {nba_id} matched several bbref ids: {pids}")
    seen = collections.Counter((c["pid"], c["season"]) for c in charts if c["pid"])
    clash = [k for k, n in seen.items() if n > 1]
    if clash:
        raise ValueError(f"bbref ids matched twice in a season: {clash[:5]}")

    # ---------- fame ----------
    def fame_raw(pid, season, ppg):
        """Points: how famous the player is (career), what this season was, scoring, and a little recency."""
        scoring = 0.8 * min(max((ppg or 0) - 5, 0), 27)
        recency = 2.0 * (season - SEASONS[0]) / (SEASONS[-1] - SEASONS[0])
        if not pid:
            return scoring + recency
        nba = allnba[pid]
        career = (1.2 * min(len(allstar[pid]), 15)
                  + 0.8 * min(len(nba), 12)
                  + 2.5 * min(len(mvp[pid]), 4)
                  + 3.0 * min(career_pts[pid] / 20000, 1.0)
                  + 1.5 * min(len(smoy[pid]), 2)
                  + 1.0 * bool(roy[pid]))
        this = (10.0 * (season in allstar[pid])
                + {"1st": 12.0, "2nd": 9.0, "3rd": 6.0}.get(nba.get(season), 0.0)
                + 8.0 * (season in mvp[pid])
                + 8.0 * mvp_share.get((pid, season), 0.0))
        return career + this + scoring + recency

    out = []
    for c in charts:
        pid, season, p = c["pid"], c["season"], c["p"]
        t = totals.get((pid, season)) if pid else None
        g = num(t["g"]) if t else None
        per_game = (lambda col: round(num(t[col]) / g, 1) if t and g and num(t[col]) is not None else None)
        line = {"pts": per_game("pts"), "reb": per_game("trb"), "ast": per_game("ast")}
        team = c["teams"][0]
        abbr = team_abbr.get((season, team)) or team[:3].upper()
        nba_pos = p["pos"].most_common(1)[0][0] if p["pos"] else None
        pos = nba_pos or (t["pos"] if t and t["pos"] not in ("", "NA") else None)
        name = t["player"] if t else p["name"].most_common(1)[0][0]
        out.append({
            "id": f"{pid}-{season}" if pid else f"nba{c['nba_id']}-{season}",
            "pid": pid,
            "nbaId": c["nba_id"],
            "name": name,
            "season": season,
            "team": {"abbr": abbr, "name": team},
            "pos": pos,
            "fga": c["fga"],
            "fgm": sum(m for m, _ in p["zones"].values()),
            "zones": p["zones"],
            "line": line,
            "allStar": bool(pid) and season in allstar[pid],
            "_raw": fame_raw(pid, season, line["pts"]),
            "_ever_allstar": bool(pid) and bool(allstar[pid]),
        })

    # Position fallback for seasons without NBA.com positions (2024-25) and unmatched players.
    last_pos = {}
    for v in sorted(out, key=lambda v: v["season"]):
        if v["pos"]:
            last_pos[v["nbaId"]] = v["pos"]
    for v in out:
        v["pos"] = v["pos"] or last_pos.get(v["nbaId"]) or "SF"

    top = max(v["_raw"] for v in out)
    for v in out:
        v["fame"] = round(100 * v["_raw"] / top, 1)
    out.sort(key=lambda v: (-v["_raw"], v["id"]))
    n = len(out)
    cuts = [round(f * n) for f in TIER_CUTS]
    moved = 0
    for i, v in enumerate(out):
        v["tier"] = 1 + sum(i >= cut for cut in cuts)
        if v["tier"] == 5 and v["_ever_allstar"]:
            v["tier"] = 4
            moved += 1
    for v in out:
        del v["_raw"], v["_ever_allstar"]

    data = {"version": 1, "zones": ZONES, "league": league, "charts": out}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    tiers = collections.Counter(v["tier"] for v in out)
    unmatched = sorted({(v["name"], v["nbaId"]) for v in out if not v["pid"]})
    print(f"match: {dict(matcher.how)}")
    print(f"bbref match rate {sum(1 for v in out if v['pid']) / n:.1%}; unmatched players ({len(unmatched)}): "
          + ", ".join(f"{nm} ({i})" for nm, i in unmatched))
    print(f"tiers: {dict(sorted(tiers.items()))} ({moved} ever-All-Star charts moved from tier 5 to 4)")
    print(f"wrote {n} charts of {len({v['nbaId'] for v in out})} players to {os.path.relpath(OUT, ROOT)} "
          f"({os.path.getsize(OUT):,} bytes)")


if __name__ == "__main__":
    main()
