"""Sanity checks for Deep Cut prompts and answers (run: python3 -I scripts/data/test_deepcut.py).

Every valid answer must come from the stats data, so these spot checks are facts anyone can verify
on Basketball-Reference.
"""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
PROMPTS = os.path.join(ROOT, "src", "data", "deepcut-prompts.json")
NAMES = os.path.join(ROOT, "src", "data", "deepcut-names.json")
TIERS = {"layup", "toocute", "midrange", "three", "logo", "halfcourt"}
failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def main():
    for p in (PROMPTS, NAMES):
        if not os.path.exists(p):
            print("FAIL: missing", p)
            sys.exit(1)
    prompts = {p["id"]: p for p in json.load(open(PROMPTS, encoding="utf-8"))}
    names = json.load(open(NAMES, encoding="utf-8"))
    ids = {n["i"] for n in names}

    check(len(prompts) >= 200, f"only {len(prompts)} prompts")
    general = [p for p in prompts.values() if p["kind"] == "general"]
    specific = [p for p in prompts.values() if p["kind"] == "specific"]
    check(len(general) >= 90, f"only {len(general)} general prompts (3 a day)")
    check(len(specific) >= 120, f"only {len(specific)} specific prompts (4 a day)")
    check(len(ids) == len(names), "duplicate ids in the names list")
    check(len({n["n"] for n in names}) == len(names), "two players share an autocomplete label")

    for p in prompts.values():
        tag = f'{p["id"]} "{p["text"]}"'
        check(p["kind"] in ("general", "specific"), f"{tag}: kind {p['kind']}")
        check(p["text"].startswith("Name "), f"{tag}: prompts start with 'Name'")
        check(len(p["answers"]) >= 8, f"{tag}: only {len(p['answers'])} answers")
        check(set(p["answers"].values()) <= TIERS, f"{tag}: unknown tier")
        check(all(a in ids for a in p["answers"]), f"{tag}: answer missing from the names list")
        layups = sum(t == "layup" for t in p["answers"].values())
        check(2 <= layups <= 8, f"{tag}: {layups} layups")
        check(sum(t in ("three", "logo", "halfcourt") for t in p["answers"].values()) >= 3, f"{tag}: too few rare answers")

    def valid(prompt_id, *pids):
        p = prompts.get(prompt_id)
        check(p is not None, f"missing prompt {prompt_id}")
        for pid in pids:
            check(p is not None and pid in p["answers"], f"{pid} should be valid for {prompt_id}")

    def invalid(prompt_id, *pids):
        p = prompts.get(prompt_id)
        for pid in pids:
            check(p is not None and pid not in p["answers"], f"{pid} should NOT be valid for {prompt_id}")

    def tier(prompt_id, pid, expected):
        p = prompts.get(prompt_id, {"answers": {}})
        check(p["answers"].get(pid) == expected, f"{pid} on {prompt_id} is {p['answers'].get(pid)}, expected {expected}")

    valid("threes-250", "curryst01", "hardeja01")
    invalid("threes-250", "jamesle01", "bryanko01")
    valid("pick-1", "jamesle01", "duncati01", "brownkw01", "thompmy01")
    invalid("pick-1", "bryanko01", "jordami01")
    valid("mvp", "jordami01", "nashst01", "rosede01", "jokicni01")
    invalid("mvp", "bryanko02", "paulch01", "anthoca01")
    valid("teammate-bryanko01", "onealsh01", "gasolpa01", "parkesm01", "rodmade01")
    invalid("teammate-bryanko01", "jamesle01")
    valid("team-thunder", "duranke01", "paytoga01", "ewingpa01")  # franchise history counts the SuperSonics
    invalid("team-thunder", "jamesle01")
    valid("team-celtics", "birdla01", "wilkido01", "maravpe01")
    valid("fifty-forty-ninety", "curryst01", "nashst01", "birdla01")
    invalid("fifty-forty-ninety", "jamesle01")
    valid("short", "boguemu01", "webbsp01")
    valid("tall", "mingya01", "bolma01")
    invalid("tall", "onealsh01")
    valid("both-lakers-celtics", "onealsh01", "paytoga01", "rondora01")
    valid("smoy", "jonesbo01")  # 1983 winner's row has no id in the source; the builder recovers it

    # Tiers: the obvious answers are layups, hand picks land where the curation file says
    tier("mvp", "jordami01", "layup")
    tier("team-bulls", "jordami01", "layup")
    tier("pick-1", "brownkw01", "toocute")
    tier("pick-1", "thompmy01", "halfcourt")
    tier("team-thunder", "ewingpa01", "halfcourt")

    if failures:
        print(f"FAIL ({len(failures)}):")
        for f in failures[:60]:
            print(" -", f)
        sys.exit(1)
    print(f"OK: {len(prompts)} prompts ({len(general)} general, {len(specific)} specific), {len(names)} names")


if __name__ == "__main__":
    main()
