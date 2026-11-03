"""Sanity checks for the Starting Five player pool (run: python3 -I scripts/data/test_players.py)."""
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
    players = json.load(open(PATH, encoding="utf-8"))
    by_name = {p["name"]: p for p in players}

    check(450 <= len(players) <= 800, f"pool size {len(players)} not in [450, 800]")
    check(len({p["id"] for p in players}) == len(players), "duplicate ids")
    for p in players:
        for k in RATINGS:
            v = p["r"][k]
            check(isinstance(v, int) and 0 <= v <= 99, f"{p['name']} r.{k}={v}")
        check(isinstance(p["ovr"], int) and 0 <= p["ovr"] <= 99, f"{p['name']} ovr={p['ovr']}")
        s = p["shot"]
        check(abs(s["rim"] + s["mid"] + s["three"] - 1) <= 0.01, f"{p['name']} shot sum")
        for k, v in p["line"].items():
            check(v is None or (isinstance(v, (int, float)) and not math.isnan(v)), f"{p['name']} line.{k}={v}")
        check(p["tier"] in ("legend", "allstar", "starter", "role"), f"{p['name']} tier")
        check(p["prime"]["from"] <= p["prime"]["to"], f"{p['name']} prime span")
        check(0.08 <= p["usg"] <= 0.45, f"{p['name']} usg={p['usg']}")

    def get(name):
        p = by_name.get(name)
        check(p is not None, f"missing player {name}")
        return p or {"r": {k: -1 for k in RATINGS}, "line": {}, "tier": None}

    check(get("Stephen Curry")["r"]["spc"] >= 95, "Curry spc")
    shaq = get("Shaquille O'Neal")
    check(shaq["r"]["reb"] >= 85, f"Shaq reb {shaq['r']['reb']}")
    check(shaq["r"]["spc"] <= 25, f"Shaq spc {shaq['r']['spc']}")
    check(get("Magic Johnson")["r"]["ply"] >= 95, "Magic ply")
    russell = get("Bill Russell")
    check(russell["r"]["rim"] >= 85, f"Russell rim {russell['r']['rim']}")
    check(russell["line"].get("stl", 0) is None, "Russell stl should be None")
    check(get("Dikembe Mutombo")["r"]["rim"] >= 95, "Mutombo rim")
    west = get("Jerry West")["r"]["spc"]
    check(55 <= west <= 85, f"West spc {west}")
    check(get("John Stockton")["r"]["ply"] >= 95, "Stockton ply")
    check(get("Michael Jordan")["tier"] == "legend", "MJ legend")

    if failures:
        print(f"FAIL: {len(failures)} problem(s)")
        for f in failures[:40]:
            print(" -", f)
        sys.exit(1)
    print(f"PASS: {len(players)} players")


if __name__ == "__main__":
    main()
