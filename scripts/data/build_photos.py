"""Match freely licensed, dated Wikimedia Commons photos to player-seasons.

For each player (Basketball-Reference id -> Wikidata -> Commons category), list the photos in his
Commons category, read each photo's date (EXIF DateTimeOriginal, else a year in the file name), and
pick one taken during that season (Oct of the start year through Jun of the end year). Only free
licenses (CC BY / CC BY-SA / CC0 / public domain) are kept, with the artist and license for credit.

Commons rate-limits shared addresses hard, so this goes slowly (one request every few seconds,
backing off on HTTP 429) and caches every response under .data-cache/wm/ so it can resume.

Input:  src/data/sf-players.json, src/data/shotcharts.json
Output: src/data/photos.json  {versionId: {u: thumb url, a: artist, l: license, f: file page}}
Run:    python3 -I scripts/data/build_photos.py [--limit N]
"""
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, ".data-cache", "wm")
OUT = os.path.join(ROOT, "src", "data", "photos.json")
UA = "TripdubDataBuilder/0.1 (https://github.com/harry66u/Tripdub)"
FREE = re.compile(r"^(CC BY(-SA)? \d\.\d|CC0|Public domain|PD)", re.I)

interval = 6.0


def get(url, cache_file):
    global interval
    if os.path.exists(cache_file):
        with open(cache_file, encoding="utf-8") as f:
            return json.load(f)
    for attempt in range(8):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Api-User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
            os.makedirs(os.path.dirname(cache_file), exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f)
            time.sleep(interval)
            interval = max(4.0, interval * 0.95)
            return data
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                wait = max(60, int(e.headers.get("retry-after") or 30) * 2) * (1 + attempt)
                interval = min(30.0, interval * 1.5)
                print(f"  rate limited, waiting {wait}s (interval now {interval:.0f}s)", flush=True)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"gave up on {url}")


def commons_categories():
    path = os.path.join(CACHE, "cats.json")
    q = "SELECT ?bbref ?cat WHERE { ?p wdt:P2685 ?bbref . ?p wdt:P373 ?cat . }"
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q, "format": "json"})
    d = get(url, path)
    return {b["bbref"]["value"].split("/")[-1]: b["cat"]["value"] for b in d["results"]["bindings"]}


def category_files(cat):
    safe = re.sub(r"[^A-Za-z0-9]+", "_", cat)[:80]
    params = {
        "action": "query",
        "format": "json",
        "generator": "categorymembers",
        "gcmtitle": "Category:" + cat,
        "gcmtype": "file",
        "gcmlimit": "200",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": "500",
        "iiextmetadatafilter": "DateTimeOriginal|LicenseShortName|Artist",
    }
    d = get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params), os.path.join(CACHE, "cat", safe + ".json"))
    return list(d.get("query", {}).get("pages", {}).values())


def photo_date(title, em):
    raw = (em.get("DateTimeOriginal") or {}).get("value", "")
    m = re.search(r"(19[5-9]\d|20[0-2]\d)[-:/.](\d{1,2})", re.sub(r"<[^>]+>", "", raw))
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"\b(19[5-9]\d|20[0-2]\d)\b", raw) or re.search(r"\b(19[5-9]\d|20[0-2]\d)\b", title)
    return (int(m.group(1)), None) if m else None


def clean_artist(s):
    s = re.sub(r"<[^>]+>", "", html.unescape(s or "")).strip()
    s = re.sub(r"\s+", " ", s)
    return s[:60] or "Unknown"


def in_season(date, season):
    y, mo = date
    if mo is None:
        return y in (season - 1, season)
    return (y == season - 1 and mo >= 10) or (y == season and mo <= 6)


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    sf = json.load(open(os.path.join(ROOT, "src", "data", "sf-players.json"), encoding="utf-8"))
    shots = json.load(open(os.path.join(ROOT, "src", "data", "shotcharts.json"), encoding="utf-8"))["charts"]
    # Seasons we need per player; Starting Five players first (most-seen faces), stars first.
    wanted, names, order = {}, {}, []
    for v in sorted(sf, key=lambda v: -v["ovr"]):
        if v["pid"] not in wanted:
            order.append(v["pid"])
        wanted.setdefault(v["pid"], set()).add(v["season"])
        names[v["pid"]] = v["name"]
    for c in sorted(shots, key=lambda c: -c["fame"]):
        if not c["pid"]:
            continue
        if c["pid"] not in wanted:
            order.append(c["pid"])
        wanted.setdefault(c["pid"], set()).add(c["season"])
        names.setdefault(c["pid"], c["name"])
    cats = commons_categories()
    out = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    done = 0
    for pid in order[:limit]:
        cat = cats.get(pid)
        if not cat:
            continue
        try:
            files = category_files(cat)
        except Exception as e:  # keep going; a later run resumes from the cache
            print(f"skip {pid}: {e}", flush=True)
            continue
        last = re.sub(r"\(.*\)", "", names[pid]).split()[-1].lower()
        candidates = []
        for f in files:
            title = f.get("title", "")
            ii = (f.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata") or {}
            lic = (em.get("LicenseShortName") or {}).get("value", "")
            if ii.get("mime") not in ("image/jpeg", "image/png") or not FREE.search(lic):
                continue
            if last not in title.lower():
                continue
            date = photo_date(title, em)
            if not date:
                continue
            score = (3 if "crop" in title.lower() else 0) + (1 if ii.get("height", 0) > ii.get("width", 1) else 0)
            candidates.append((date, score, title, ii, em, lic))
        for season in wanted[pid]:
            matches = [c for c in candidates if in_season(c[0], season)]
            if not matches:
                continue
            date, score, title, ii, em, lic = max(matches, key=lambda c: (c[1], c[0][1] is not None))
            out[f"{pid}-{season}"] = {
                "u": ii.get("thumburl") or ii.get("url"),
                "a": clean_artist((em.get("Artist") or {}).get("value", "")),
                "l": lic,
                "f": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
            }
        done += 1
        if done % 10 == 0:
            with open(OUT, "w", encoding="utf-8") as fh:
                json.dump(out, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            print(f"{done} players checked, {len(out)} season photos so far", flush=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print(f"done: {done} players checked, {len(out)} season photos", flush=True)


if __name__ == "__main__":
    main()
