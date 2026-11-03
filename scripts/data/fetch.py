"""Download raw public datasets into .data-cache/ (git-ignored).

Sources
- Basketball-Reference season tables, via the open CSV mirror
  https://github.com/sumitrodatta/bball-reference-datasets
- NBA.com regular-season shot locations 2003-04..2024-25, via
  https://github.com/DomSamangy/NBA_Shots_04_25
- Basketball-Reference <-> NBA.com player id crosswalk (through 2019-20), via
  https://github.com/djblechn-su/nba-player-team-ids

Usage: python3 -I scripts/data/fetch.py [--shots]
"""
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, ".data-cache")
BBREF = "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/"
SHOTS = "https://raw.githubusercontent.com/DomSamangy/NBA_Shots_04_25/main/"
IDS = "https://raw.githubusercontent.com/djblechn-su/nba-player-team-ids/master/NBA_Player_IDs.csv"
BBREF_FILES = [
    "Advanced", "Player Per Game", "Player Totals", "Player Shooting", "Player Play By Play",
    "All-Star Selections", "End of Season Teams", "Player Award Shares", "Player Career Info",
    "Team Summaries",
]


def download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    with urllib.request.urlopen(url, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 16):
            f.write(chunk)
    os.replace(tmp, dest)
    print("fetched", os.path.relpath(dest, ROOT))


def main():
    for name in BBREF_FILES:
        download(BBREF + urllib.parse.quote(name) + ".csv", os.path.join(CACHE, "bbref", name + ".csv"))
    download(IDS, os.path.join(CACHE, "ids", "nba_ids.csv"))
    if "--shots" in sys.argv:
        for year in range(2004, 2026):
            fn = f"NBA_{year}_Shots.csv.zip"
            download(SHOTS + fn, os.path.join(CACHE, "shots", fn))


if __name__ == "__main__":
    main()
