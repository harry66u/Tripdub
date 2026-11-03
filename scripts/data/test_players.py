"""Sanity checks for the Starting Five pool of player-season versions.

Run: python3 -I scripts/data/test_players.py
"""
import json
import math
import os
import sys

PATH = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "sf-players.json")
RATINGS = ("sco", "ply", "reb", "per", "rim", "spc")
failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def main():
    if not os.path.exists(PATH):
        print("FAIL: missing", PATH)
        sys.exit(1)
    versions = json.load(open(PATH, encoding="utf-8"))
    by_key = {(v["name"], v["season"]): v for v in versions}
    by_name = {}
    for v in versions:
        by_name.setdefault(v["name"], []).append(v)

    check(1200 <= len(versions) <= 3000, f"pool size {len(versions)} not in [1200, 3000]")
    check(len({v["id"] for v in versions}) == len(versions), "duplicate ids")
    for v in versions:
        check(v["id"] == f"{v['pid']}-{v['season']}", f"{v['name']} id format {v['id']}")
        check(isinstance(v["season"], int) and 1950 <= v["season"] <= 2027, f"{v['name']} season {v['season']}")
        check(bool(v["team"]["abbr"]) and bool(v["team"]["name"]), f"{v['name']} {v['season']} missing team")
        for k in RATINGS:
            r = v["r"][k]
            check(isinstance(r, int) and 0 <= r <= 99, f"{v['name']} r.{k}={r}")
        check(isinstance(v["ovr"], int) and 0 <= v["ovr"] <= 99, f"{v['name']} ovr")
        s = v["shot"]
        check(abs(s["rim"] + s["mid"] + s["three"] - 1) <= 0.01, f"{v['name']} shot sum")
        for k, x in v["line"].items():
            check(x is None or (isinstance(x, (int, float)) and not math.isnan(x)), f"{v['name']} line.{k}={x}")
        check(v["tier"] in ("legend", "allstar", "starter", "role"), f"{v['name']} tier")
        check(0.08 <= v["usg"] <= 0.45, f"{v['name']} usg={v['usg']}")
        if v["season"] < 1980:
            c = v["career"]
            check(v["acc"]["hof"] or c["mvp"] >= 1 or c["allNba"] >= 3, f"{v['name']} ({v['season']}) is too obscure for the pool")

    recent = sum(v["season"] >= 2005 for v in versions) / len(versions)
    old = sum(v["season"] < 1980 for v in versions) / len(versions)
    check(recent >= 0.5, f"only {recent:.0%} of versions are 2005 or later")
    check(old <= 0.08, f"{old:.0%} of versions are before 1980")
    with_photo = sum(isinstance(v.get("nbaId"), int) for v in versions)
    check(with_photo >= 0.98 * len(versions), f"only {with_photo}/{len(versions)} versions have an NBA.com id")

    def ver(name, season):
        v = by_key.get((name, season))
        check(v is not None, f"missing version {season} {name}")
        return v or {"r": {k: -1 for k in RATINGS}, "line": {}, "tier": None, "team": {}, "nbaId": None, "acc": {}}

    check(ver("Stephen Curry", 2016)["r"]["spc"] >= 97, "2016 Curry spc")
    check(ver("Stephen Curry", 2016)["acc"].get("mvp") is True, "2016 Curry was MVP")
    check(ver("LeBron James", 2013)["tier"] == "legend", "2013 LeBron legend")
    check(ver("LeBron James", 2013)["team"].get("abbr") == "MIA", "2013 LeBron on MIA")
    check(ver("LeBron James", 2013)["nbaId"] == 2544, "LeBron nbaId")
    check(ver("Damian Lillard", 2020)["team"].get("abbr") == "POR", "2020 Dame on POR")
    shaq = ver("Shaquille O'Neal", 2000)
    check(shaq["r"]["reb"] >= 80 and shaq["r"]["spc"] <= 25, f"2000 Shaq reb/spc {shaq['r']}")
    check(ver("Magic Johnson", 1987)["r"]["ply"] >= 95, "1987 Magic ply")
    check(any(v["r"]["rim"] >= 95 for v in by_name.get("Dikembe Mutombo", [])), "Mutombo rim")
    russ = by_name.get("Bill Russell", [])
    check(bool(russ) and all(v["line"]["stl"] is None for v in russ), "Bill Russell versions lack steals")
    check(any(v["nbaId"] == 1641705 for v in by_name.get("Victor Wembanyama", [])), "Wemby present")
    check(all(len(vs) <= 4 for vs in by_name.values()), "a player has more than 4 versions")

    if failures:
        print(f"FAIL: {len(failures)} problem(s)")
        for f in failures[:40]:
            print(" -", f)
        sys.exit(1)
    print(f"PASS: {len(versions)} versions of {len(by_name)} players; {recent:.0%} from 2005+, {old:.0%} pre-1980")


if __name__ == "__main__":
    main()
