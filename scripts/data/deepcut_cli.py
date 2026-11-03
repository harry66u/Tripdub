"""Review and edit Deep Cut prompts, answers and tiers.

  npm run deepcut -- list [words]                 prompts (filter by id or text)
  npm run deepcut -- show <prompt>                every valid answer, by tier
  npm run deepcut -- player <name>                prompts a player answers, and the tier
  npm run deepcut -- tier <prompt> <name> <tier>  set a tier: layup toocute midrange three logo halfcourt
  npm run deepcut -- halfcourt <prompt> <name>    hand-pick a Half-Court answer (same as tier ... halfcourt)
  npm run deepcut -- toocute <prompt> <name>      mark a Too Cute answer
  npm run deepcut -- untier <prompt> <name>       drop a hand-set tier (back to automatic)
  npm run deepcut -- add <prompt> <name>          count an extra valid answer
  npm run deepcut -- remove <prompt> <name>       stop counting an answer
  npm run deepcut -- disable <prompt> | enable <prompt>
  npm run deepcut -- reword <prompt> "<text>" ["<fine print>"]

Edits go to content/deep-cut/curation.json and the prompt bank is rebuilt right away. Live days pick
up new tiers immediately; a disabled prompt is swapped out of any day that used it.
"""
import json
import os
import subprocess
import sys
import unicodedata
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CURATION = os.path.join(ROOT, "content", "deep-cut", "curation.json")
PROMPTS = os.path.join(ROOT, "src", "data", "deepcut-prompts.json")
NAMES = os.path.join(ROOT, "src", "data", "deepcut-names.json")
TIERS = ["layup", "toocute", "midrange", "three", "logo", "halfcourt"]
LABEL = {"layup": "Layup (10)", "toocute": "Too Cute (15)", "midrange": "Midrange (30)", "three": "Three (60)", "logo": "Logo Shot (85)", "halfcourt": "Half-Court (100)"}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", re.sub(r"['’.]", "", s)).strip()


def load():
    prompts = {p["id"]: p for p in json.load(open(PROMPTS, encoding="utf-8"))}
    names = json.load(open(NAMES, encoding="utf-8"))
    return prompts, names


def find_player(names, text):
    if any(n["i"] == text for n in names):
        return text
    q = norm(text)
    hits = [n for n in names if q in [norm(re.sub(r"\s*\(.*\)$", "", n["n"])), norm(n["n"])] + [norm(a) for a in n.get("a", [])]]
    if len(hits) == 1:
        return hits[0]["i"]
    if hits:
        sys.exit("Several players match; use an id:\n" + "\n".join(f'  {h["i"]}  {h["n"]} ({h["y"]})' for h in hits))
    close = [n for n in names if q and q in norm(n["n"])][:8]
    sys.exit(f'No player named "{text}".' + ("\nDid you mean:\n" + "\n".join(f'  {h["i"]}  {h["n"]} ({h["y"]})' for h in close) if close else ""))


def find_prompt(prompts, pid, curation=None):
    if pid in prompts or (curation is not None and pid in curation):
        return pid
    close = [k for k in prompts if pid in k][:10]
    sys.exit(f'No prompt "{pid}".' + (" Did you mean: " + ", ".join(close) if close else ' Try: npm run deepcut -- list'))


def edit(fn):
    cur = json.load(open(CURATION, encoding="utf-8")) if os.path.exists(CURATION) else {}
    fn(cur)
    about = {k: v for k, v in cur.items() if k.startswith("_")}
    body = {k: cur[k] for k in sorted(k for k in cur if not k.startswith("_")) if cur[k]}
    with open(CURATION, "w", encoding="utf-8") as f:
        f.write("{\n")
        items = list(about.items()) + list(body.items())
        for i, (k, v) in enumerate(items):
            f.write(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}{',' if i < len(items) - 1 else ''}\n")
        f.write("}\n")
    r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "scripts", "data", "build_deepcut.py"), "--strict"])
    if r.returncode:
        sys.exit("Rebuild failed; fix the curation problem above.")


def drop_hand(entry, pid, names):
    for key in ("tooCute", "halfCourt"):
        entry[key] = [n for n in entry.get(key, []) if n != pid and find_player(names, n) != pid]
        if not entry[key]:
            entry.pop(key)
    tiers = {n: t for n, t in (entry.get("tiers") or {}).items() if n != pid and find_player(names, n) != pid}
    if tiers:
        entry["tiers"] = tiers
    else:
        entry.pop("tiers", None)


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    prompts, names = load()
    label = {n["i"]: n["n"] for n in names}
    cmd = a[0]

    if cmd == "list":
        q = " ".join(a[1:]).lower()
        for p in sorted(prompts.values(), key=lambda p: (p["kind"], p["fam"], p["id"])):
            if q in p["id"] or q in p["text"].lower():
                print(f'{p["id"]:34} {p["kind"]:9} {len(p["answers"]):4} answers  ease {p["ease"]:3}  {p["text"]}')
        return
    if cmd == "show":
        p = prompts[find_prompt(prompts, a[1])]
        print(f'{p["text"]}\n  {p["note"]}\n  {p["kind"]}, {len(p["answers"])} valid answers, ease {p["ease"]}')
        for t in TIERS:
            ids = sorted((i for i, x in p["answers"].items() if x == t), key=lambda i: label.get(i, i))
            if ids:
                print(f"\n{LABEL[t]}: {len(ids)}")
                print("  " + ", ".join(label.get(i, i) for i in ids))
        return
    if cmd == "player":
        pid = find_player(names, " ".join(a[1:]))
        print(label[pid])
        for p in sorted(prompts.values(), key=lambda p: p["id"]):
            if pid in p["answers"]:
                print(f'  {LABEL[p["answers"][pid]]:18} {p["id"]:34} {p["text"]}')
        return

    if len(a) < 2:
        sys.exit(__doc__)
    if cmd in ("disable", "enable"):
        pid_ = a[1]
        cur_ids = json.load(open(CURATION, encoding="utf-8")) if os.path.exists(CURATION) else {}
        find_prompt(prompts, pid_, cur_ids)

        def toggle(cur):
            e = cur.setdefault(pid_, {})
            if cmd == "disable":
                e["disabled"] = True
            else:
                e.pop("disabled", None)
        edit(toggle)
        print(f"{pid_} {cmd}d")
        return
    if cmd == "reword":
        pid_ = find_prompt(prompts, a[1])

        def reword(cur):
            e = cur.setdefault(pid_, {})
            e["text"] = a[2]
            if len(a) > 3:
                e["note"] = a[3]
        edit(reword)
        return

    pid_ = find_prompt(prompts, a[1])
    if len(a) < 3:
        sys.exit(__doc__)
    player = find_player(names, a[2])
    name = label[player].split(" (")[0]
    # Store by name when it is unambiguous, so the file stays readable
    key = name if sum(1 for n in names if n["n"].split(" (")[0] == name) == 1 else player

    if cmd in ("tier", "halfcourt", "toocute", "untier"):
        tier = a[3] if cmd == "tier" else cmd
        if cmd != "untier" and tier not in TIERS:
            sys.exit(f"Tier must be one of: {', '.join(TIERS)}")
        if cmd != "untier" and player not in prompts[pid_]["answers"]:
            sys.exit(f"{name} isn't a valid answer for {pid_}. Use: npm run deepcut -- add {pid_} \"{name}\"")

        def set_tier(cur):
            e = cur.setdefault(pid_, {})
            drop_hand(e, player, names)
            if cmd == "untier":
                return
            if tier == "halfcourt":
                e.setdefault("halfCourt", []).append(key)
            elif tier == "toocute":
                e.setdefault("tooCute", []).append(key)
            else:
                e.setdefault("tiers", {})[key] = tier
        edit(set_tier)
        print(f"{pid_}: {name} -> {'automatic' if cmd == 'untier' else tier}")
        return
    if cmd in ("add", "remove"):
        def change(cur):
            e = cur.setdefault(pid_, {})
            other = "remove" if cmd == "add" else "add"
            e[other] = [n for n in e.get(other, []) if find_player(names, n) != player]
            if not e[other]:
                e.pop(other)
            if key not in e.get(cmd, []):
                e.setdefault(cmd, []).append(key)
            if cmd == "remove":
                drop_hand(e, player, names)
        edit(change)
        print(f"{pid_}: {cmd} {name}")
        return
    sys.exit(__doc__)


if __name__ == "__main__":
    main()
