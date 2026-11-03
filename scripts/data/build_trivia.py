"""Build the trivia bank from the Open Trivia Database.

Source: Open Trivia Database (https://opentdb.com), CC BY-SA 4.0, via the full dump at
https://github.com/leakyhose/open-trivia-script-data. Keeps general-knowledge categories,
decodes HTML entities, and drops niche fandom and time-sensitive questions.

Input:  .data-cache/trivia/opentdb.json   (scripts/data/fetch.py downloads it)
Output: src/data/trivia.json  [{id, q, a: [correct, wrong, wrong, wrong], cat, diff}]
"""
import hashlib
import html
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, ".data-cache", "trivia", "opentdb.json")
OUT = os.path.join(ROOT, "src", "data", "trivia.json")

CATEGORIES = {
    "General Knowledge": "General knowledge",
    "History": "History",
    "Geography": "Geography",
    "Science & Nature": "Science",
    "Science: Mathematics": "Math",
    "Science: Computers": "Tech",
    "Entertainment: Film": "Movies",
    "Entertainment: Music": "Music",
    "Entertainment: Television": "TV",
    "Entertainment: Books": "Books",
    "Sports": "Sports",
    "Animals": "Animals",
    "Mythology": "Mythology",
    "Art": "Art",
    "Celebrities": "Celebrities",
    "Politics": "Politics",
    "Vehicles": "Vehicles",
}
# Fandom deep cuts that slip into general categories.
NICHE = re.compile(
    r"video game|videogame|pok[eé]mon|minecraft|nintendo|playstation|xbox|anime|manga|nicktoon|cartoon|"
    r"\bdota\b|league of legends|overwatch|fortnite|warcraft|zelda|mario|sonic|resident evil|"
    r"call of duty|final fantasy|half-life|steam|twitch|youtuber|undertale",
    re.I,
)
TIME_SENSITIVE = re.compile(r"\b(currently|current|as of|latest|this year|recent(ly)?|today|still|now)\b", re.I)


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def main():
    raw = json.load(open(SRC, encoding="utf-8"))
    out, seen = [], set()
    for r in raw:
        if r.get("type") != "multiple":
            continue
        cat = CATEGORIES.get(clean(r["category"]))
        if not cat:
            continue
        q = clean(r["question"])
        answers = [clean(r["correct_answer"])] + [clean(a) for a in r["incorrect_answers"]]
        if len(answers) != 4 or len({a.lower() for a in answers}) != 4 or not all(answers):
            continue
        if any(len(a) > 60 for a in answers) or len(q) > 220:
            continue
        if NICHE.search(q) or any(NICHE.search(a) for a in answers):
            continue
        if TIME_SENSITIVE.search(q):
            continue
        # Events after 2015 age quickly; keep the bank evergreen.
        if any(int(y) >= 2015 for y in re.findall(r"\b(20\d\d)\b", q)):
            continue
        key = q.lower()
        if key in seen:
            continue
        seen.add(key)
        qid = "q" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]
        out.append({"id": qid, "q": q, "a": answers, "cat": cat, "diff": r["difficulty"]})
    out.sort(key=lambda x: x["id"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    mix = {d: sum(x["diff"] == d for x in out) for d in ("easy", "medium", "hard")}
    print(f"wrote {len(out)} questions to {os.path.relpath(OUT, ROOT)} {mix}")


if __name__ == "__main__":
    main()
