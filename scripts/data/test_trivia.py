"""Sanity checks for the NBA trivia bank (run: python3 -I scripts/data/test_trivia.py)."""
import json
import os
import re
import sys

PATH = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "trivia.json")
CATS = {"Awards", "Stat leaders", "Teams", "College", "Standings", "Numbers", "All-Stars"}
failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def main():
    if not os.path.exists(PATH):
        print("FAIL: missing", PATH)
        sys.exit(1)
    bank = json.load(open(PATH, encoding="utf-8"))
    check(1500 <= len(bank) <= 6000, f"bank size {len(bank)}")
    check(len({q["id"] for q in bank}) == len(bank), "duplicate ids")
    check(len({(q["q"], tuple(sorted(q["a"]))) for q in bank}) == len(bank), "duplicate question")
    by_diff = {d: sum(q["diff"] == d for q in bank) for d in ("easy", "medium", "hard")}
    check(min(by_diff.values()) >= 200, f"difficulty mix {by_diff}")
    for q in bank:
        tag = f'{q["id"]} "{q["q"]}"'
        check(len(q["a"]) == 4 and len({a.lower() for a in q["a"]}) == 4, f"{tag} needs 4 distinct answers {q['a']}")
        check(all(a == a.strip() and a for a in q["a"]), f"{tag} answer whitespace")
        check(q["cat"] in CATS, f"{tag} category {q['cat']}")
        check(q["diff"] in ("easy", "medium", "hard"), f"{tag} diff")
        check(not re.search(r"\bnan\b|None|NA\b", " ".join(q["a"]) + q["q"]), f"{tag} has a missing value")

    def find(pattern):
        hits = [q for q in bank if re.search(pattern, q["q"])]
        check(bool(hits), f"no question matching {pattern}")
        return hits[0] if hits else {"a": [""]}

    check(find(r"MVP for the 2015–16 season")["a"][0] == "Stephen Curry", "2015-16 MVP")
    check(find(r"MVP for the 1990–91 season")["a"][0] == "Michael Jordan", "1990-91 MVP")
    check(find(r"led the NBA in points per game in 2005–06")["a"][0] == "Kobe Bryant", "2005-06 scoring leader")
    check(find(r"best regular-season record in 2015–16")["a"][0] == "Golden State Warriors", "2015-16 best record")
    check(find(r"Rookie of the Year for the 2003–04 season")["a"][0] == "LeBron James", "2003-04 ROY")
    check(find(r"Who led the Los Angeles Lakers in scoring in 2005–06")["a"][0] == "Kobe Bryant", "2005-06 Lakers scoring")

    if failures:
        print(f"FAIL: {len(failures)} problem(s)")
        for f in failures[:30]:
            print(" -", f)
        sys.exit(1)
    cats = {c: sum(q["cat"] == c for q in bank) for c in sorted(CATS)}
    print(f"PASS: {len(bank)} questions {by_diff} {cats}")


if __name__ == "__main__":
    main()
