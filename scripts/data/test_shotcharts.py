"""Sanity checks for the Shot Chart pool (src/data/shotcharts.json).

Run: python3 -I scripts/data/test_shotcharts.py
Exits 1 with a list of problems on failure.
"""
import collections
import csv
import json
import math
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PATH = os.path.join(ROOT, "src", "data", "shotcharts.json")
ALLSTAR_CSV = os.path.join(ROOT, ".data-cache", "bbref", "All-Star Selections.csv")
ZONES = ["ra", "paint", "mid_lb", "mid_lw", "mid_c", "mid_rw", "mid_rb", "c3_l", "c3_r", "atb_l", "atb_c", "atb_r"]
THREES = ["c3_l", "c3_r", "atb_l", "atb_c", "atb_r"]
SEASONS = list(range(2004, 2026))
SHORT_SEASONS = {2012, 2020, 2021}
POS_RE = re.compile(r"^(PG|SG|SF|PF|C)(-(PG|SG|SF|PF|C))*$")
TARGET_BYTES = 1_500_000  # soft target: warn above it
MAX_BYTES = 2_000_000  # hard limit
failures = []
warnings = []


def check(cond, msg):
    if not cond:
        failures.append(msg)
    return cond


def is_count(x):
    return isinstance(x, int) and not isinstance(x, bool) and x >= 0


def is_pair(p):
    return isinstance(p, list) and len(p) == 2 and is_count(p[0]) and is_count(p[1]) and p[0] <= p[1]


def main():
    if not os.path.exists(PATH):
        print("FAIL: missing", PATH)
        sys.exit(1)
    size = os.path.getsize(PATH)
    data = json.load(open(PATH, encoding="utf-8"))
    check(data.get("version") == 1, f"version {data.get('version')!r} != 1")
    check(data.get("zones") == ZONES, f"zones {data.get('zones')!r}")
    check(size < MAX_BYTES, f"file is {size:,} bytes, limit {MAX_BYTES:,}")
    if size >= TARGET_BYTES:
        warnings.append(f"file is {size:,} bytes, above the {TARGET_BYTES:,} target")
    charts = data.get("charts") or []
    league = data.get("league") or {}
    check(len(charts) >= 2000, f"only {len(charts)} charts")

    # ---------- league averages ----------
    for s in SEASONS:
        lz = league.get(str(s))
        if not check(isinstance(lz, dict), f"league average missing for {s}"):
            continue
        check(sorted(lz) == sorted(ZONES), f"league {s} zones {sorted(lz)}")
        for z in ZONES:
            p = lz.get(z)
            if not check(is_pair(p) and p[1] > 0, f"league {s} {z} = {p!r}"):
                continue
            if z in THREES:
                pct = p[0] / p[1]
                check(0.30 <= pct <= 0.42, f"league {s} {z} FG% {pct:.3f} not in [0.30, 0.42]")
    check(sorted(league) == [str(s) for s in SEASONS], f"league seasons {sorted(league)}")

    # ---------- per chart ----------
    ids = collections.Counter(c.get("id") for c in charts)
    dup = [i for i, n in ids.items() if n > 1]
    check(not dup, f"duplicate ids: {dup[:5]}")
    nba_season = collections.Counter((c.get("nbaId"), c.get("season")) for c in charts)
    check(all(n == 1 for n in nba_season.values()), "duplicate (nbaId, season) pairs")
    for c in charts:
        label = f"{c.get('season')} {c.get('name')}"
        s, pid, nba = c.get("season"), c.get("pid"), c.get("nbaId")
        check(isinstance(s, int) and s in SEASONS, f"{label}: season {s!r}")
        check(isinstance(nba, int) and not isinstance(nba, bool) and nba > 0, f"{label}: nbaId {nba!r}")
        check(pid is None or (isinstance(pid, str) and re.fullmatch(r"[a-z'.]+\d\d", pid)), f"{label}: pid {pid!r}")
        want_id = f"{pid}-{s}" if pid else f"nba{nba}-{s}"
        check(c.get("id") == want_id, f"{label}: id {c.get('id')!r} != {want_id!r}")
        check(isinstance(c.get("name"), str) and c["name"].strip(), f"{label}: empty name")
        team = c.get("team") or {}
        check(isinstance(team.get("abbr"), str) and re.fullmatch(r"[A-Z]{3}", team.get("abbr") or ""),
              f"{label}: team abbr {team.get('abbr')!r}")
        check(isinstance(team.get("name"), str) and team.get("name"), f"{label}: team name {team.get('name')!r}")
        check(isinstance(c.get("pos"), str) and POS_RE.match(c.get("pos") or ""), f"{label}: pos {c.get('pos')!r}")
        fga, fgm = c.get("fga"), c.get("fgm")
        if not check(is_count(fga) and is_count(fgm) and fgm <= fga, f"{label}: fgm/fga {fgm!r}/{fga!r}"):
            continue
        check(fga >= (380 if s in SHORT_SEASONS else 500), f"{label}: fga {fga} below eligibility")
        zones = c.get("zones") or {}
        if not check(sorted(zones) == sorted(ZONES), f"{label}: zones {sorted(zones)}"):
            continue
        bad = [z for z in ZONES if not is_pair(zones[z])]
        if not check(not bad, f"{label}: bad zone pairs {bad}"):
            continue
        check(sum(zones[z][1] for z in ZONES) == fga, f"{label}: zone fga sum != {fga}")
        check(sum(zones[z][0] for z in ZONES) == fgm, f"{label}: zone fgm sum != {fgm}")
        line = c.get("line")
        if check(isinstance(line, dict) and sorted(line) == ["ast", "pts", "reb"], f"{label}: line {line!r}"):
            for k, v in line.items():
                check(v is None or (isinstance(v, (int, float)) and not isinstance(v, bool) and not math.isnan(v)
                                    and 0 <= v <= 60), f"{label}: line.{k}={v!r}")
            if pid:
                check(line["pts"] is not None, f"{label}: matched to bbref but no points per game")
        check(isinstance(c.get("allStar"), bool), f"{label}: allStar {c.get('allStar')!r}")
        fame = c.get("fame")
        check(isinstance(fame, (int, float)) and not isinstance(fame, bool) and 0 <= fame <= 100, f"{label}: fame {fame!r}")
        check(c.get("tier") in (1, 2, 3, 4, 5), f"{label}: tier {c.get('tier')!r}")
    check({c.get("season") for c in charts} == set(SEASONS), "not every season 2004..2025 has charts")

    # ---------- tiers ----------
    tiers = collections.defaultdict(list)
    for c in charts:
        tiers[c.get("tier")].append(c)
    for t in range(1, 6):
        check(len(tiers[t]) >= 150, f"tier {t} has {len(tiers[t])} charts (< 150)")
    for t in (1, 2, 3):
        if tiers[t] and tiers[t + 1]:
            lo = min(c["fame"] for c in tiers[t])
            hi = max(c["fame"] for c in tiers[t + 1])
            check(lo >= hi, f"tier {t} min fame {lo} < tier {t + 1} max fame {hi}")
    n = max(1, len(charts))
    check(0.07 <= len(tiers[1]) / n <= 0.13, f"tier 1 is {len(tiers[1]) / n:.1%} of the pool, want ~10%")
    stars = sum(1 for c in tiers[1] if c.get("allStar"))
    check(stars >= 0.75 * max(1, len(tiers[1])), f"only {stars}/{len(tiers[1])} tier 1 charts are All-Star seasons")
    ever_allstar = {c["pid"] for c in charts if c.get("allStar") and c.get("pid")}
    if os.path.exists(ALLSTAR_CSV):
        with open(ALLSTAR_CSV, encoding="utf-8") as f:
            ever_allstar |= {r["player_id"] for r in csv.DictReader(f) if r["lg"] == "NBA"}
    t5_stars = sorted({c["name"] for c in tiers[5] if c.get("allStar") or c.get("pid") in ever_allstar})
    check(not t5_stars, f"tier 5 has All-Stars: {t5_stars[:10]}")

    # ---------- known player-seasons ----------
    by_key = collections.defaultdict(list)
    for c in charts:
        by_key[(c.get("name"), c.get("season"))].append(c)

    def chart(name, season):
        found = by_key.get((name, season)) or []
        return found[0] if len(found) == 1 else None

    def share(c, zs):
        return sum(c["zones"][z][1] for z in zs) / c["fga"] if c and c.get("fga") else 0.0

    curry = chart("Stephen Curry", 2016)
    if check(curry is not None, "missing 2016 Stephen Curry"):
        check(curry["tier"] == 1, f"2016 Curry tier {curry['tier']}")
        check(curry["pid"] == "curryst01" and curry["nbaId"] == 201939, "2016 Curry ids")
        check(curry["team"]["abbr"] == "GSW", f"2016 Curry team {curry['team']}")
        check(share(curry, THREES) >= 0.45, f"2016 Curry three share {share(curry, THREES):.2f} < 0.45")
        check(curry["allStar"] is True, "2016 Curry was an All-Star")
    shaq = chart("Shaquille O'Neal", 2005) or chart("Shaquille O'Neal", 2004)
    if check(shaq is not None, "missing 2004/2005 Shaquille O'Neal"):
        check(share(shaq, ["ra"]) >= 0.45, f"{shaq['season']} Shaq ra share {share(shaq, ['ra']):.2f} < 0.45")
    for name, season, abbr in (("LeBron James", 2013, "MIA"), ("Kobe Bryant", 2006, "LAL")):
        c = chart(name, season)
        if check(c is not None, f"missing {season} {name}"):
            check(c["tier"] == 1, f"{season} {name} tier {c['tier']}")
            check(c["team"]["abbr"] == abbr, f"{season} {name} team {c['team']}")
    # A career role player: every eligible season (2012 itself is below the 380 FGA bar) is a deep cut.
    luc = [c for c in charts if c.get("name") == "Luc Mbah a Moute"]
    check(bool(luc), "no Luc Mbah a Moute season")
    for c in luc:
        check(c["tier"] >= 4, f"{c['season']} Luc Mbah a Moute tier {c['tier']}")

    # ---------- matching ----------
    matched = sum(1 for c in charts if c.get("pid"))
    check(matched >= 0.9 * n, f"only {matched}/{len(charts)} charts have a bbref pid")

    for w in warnings:
        print("warning:", w)
    if failures:
        print(f"FAIL: {len(failures)} problem(s)")
        for f in failures[:40]:
            print(" -", f)
        sys.exit(1)
    counts = {t: len(tiers[t]) for t in range(1, 6)}
    print(f"PASS: {len(charts)} charts, {len({c['nbaId'] for c in charts})} players, tiers {counts}, "
          f"{matched / n:.1%} matched to bbref, {size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
