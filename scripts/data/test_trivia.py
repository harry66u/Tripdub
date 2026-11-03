"""Sanity checks for the trivia bank (run: python3 -I scripts/data/test_trivia.py)."""
import json
import os
import re
import sys

PATH = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "trivia.json")
failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def main():
    if not os.path.exists(PATH):
        print("FAIL: missing", PATH)
        sys.exit(1)
    bank = json.load(open(PATH, encoding="utf-8"))
    check(1500 <= len(bank) <= 3500, f"bank size {len(bank)}")
    check(len({q["id"] for q in bank}) == len(bank), "duplicate ids")
    check(len({q["q"].lower() for q in bank}) == len(bank), "duplicate question text")
    by_diff = {d: sum(q["diff"] == d for q in bank) for d in ("easy", "medium", "hard")}
    check(min(by_diff.values()) >= 300, f"difficulty mix {by_diff}")
    for q in bank:
        tag = q["id"]
        check(len(q["a"]) == 4 and len({a.lower() for a in q["a"]}) == 4, f"{tag} needs 4 distinct answers")
        check(all(a == a.strip() and a for a in q["a"]), f"{tag} answer whitespace")
        check(all(len(a) <= 60 for a in q["a"]), f"{tag} answer too long")
        check(not re.search(r"&(#\d+|[a-z]+);", q["q"] + "".join(q["a"])), f"{tag} has HTML entities")
        check(q["diff"] in ("easy", "medium", "hard"), f"{tag} diff")
        check(q["cat"] and "Video Game" not in q["cat"] and "Anime" not in q["cat"], f"{tag} category {q['cat']}")
        check(not re.search(r"\b(currently|as of|latest|this year)\b", q["q"], re.I), f"{tag} is time-sensitive: {q['q']}")
    if failures:
        print(f"FAIL: {len(failures)} problem(s)")
        for f in failures[:30]:
            print(" -", f)
        sys.exit(1)
    print(f"PASS: {len(bank)} questions {by_diff}")


if __name__ == "__main__":
    main()
