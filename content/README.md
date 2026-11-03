# Daily content

Every daily puzzle lives in `content/schedule/<game>.json`, one line per day, keyed by date (`YYYY-MM-DD`, America/New_York puzzle day). The site reads these files on the server only, so upcoming answers never reach players' browsers.

If a date is missing, the server generates that day's puzzle from the date itself, so there is always a puzzle. Running `npm run schedule` writes those days into the file so you can see and edit them ahead of time.

## Commands

| Command | What it does |
|---|---|
| `npm run schedule` | Fills every missing day from launch through today + 730 days. Never changes days that already exist, so your edits stick. |
| `npm run schedule:check` | Validates every day (known players, no duplicates, nothing missing) and warns when the schedule runs out within 60 days. Run it after any hand edit. |
| `npm run puzzle -- show 2026-12-25` | Prints a day's puzzle with player names. |
| `npm run puzzle -- set 2026-12-25 --spins "Name, Name, ..."` | Sets the 6 spins (the 6th is only seen after a re-spin). |
| `npm run puzzle -- set 2026-12-25 --mystery "PG:Name,SG:Name,SF:Name,PF:Name,C:Name" --theme "Christmas Classics"` | Sets any or all Mystery Five slots and the theme shown to players. |
| `npm run puzzle -- reroll 2026-12-25` | Replaces the day with a fresh random puzzle. |

Every entry is one season of one player. Write "2016 Stephen Curry" (season end year: 2016 = the 2015-16 season), or just "Stephen Curry" for his best season in the pool. Names are case- and accent-insensitive ("2023 nikola jokic" works), and version ids like `curryst01-2016` work too. Only versions in `src/data/sf-players.json` can be used; `npm run puzzle -- show <date>` lists what a day uses, and the file is rebuilt with `npm run data`.

## Starting Five format

```json
"2026-12-25": {
  "spins": ["curryst01-2016", "id2", "id3", "id4", "id5", "id6"],
  "mystery": { "PG": "id", "SG": "id", "SF": "id", "PF": "id", "C": "id" },
  "theme": "Christmas Classics"
}
```

You can also edit the JSON directly, for example in GitHub's web editor. Commit the change and the next deploy picks it up.

## Deep Cut

Deep Cut prompts and their answers are built from Basketball-Reference data by `scripts/data/build_deepcut.py` into `src/data/deepcut-prompts.json` (every valid answer and its tier) and `src/data/deepcut-names.json` (the autocomplete list). The daily sets live in `content/schedule/deep-cut.json` like the other games (`{"prompts": [7 prompt ids]}` per day; `npm run schedule` fills it, three general prompts and four specific a day, easier to harder).

Everything you'd hand-edit is in `content/deep-cut/`:

| File | What it holds |
|---|---|
| `curation.json` | Per prompt: `tooCute` and `halfCourt` picks, `tiers` overrides (`{"Player": "three"}`), `add` / `remove` answers, `disabled: true`, `text` / `note` rewording. |
| `fame.json` | Casual-fan fame adjustments (+/- points on a 0-100 scale) that move players between tiers everywhere. |
| `aliases.json` | Nicknames and other names the answer box accepts ("Shaq", "Penny Hardaway", "Ron Artest"). |
| `custom-prompts.json` | Your own prompts: `[{"id": "sixty-points", "text": "Name a player who scored 60+ in a game", "note": "Regular season.", "kind": "specific", "answers": ["Kobe Bryant", "Wilt Chamberlain", "..."]}]`. Answers you list are the valid ones, so check them against a source; tiers are set the same way as every other prompt. |

The quickest way to edit is the command line, which writes `curation.json` and rebuilds:

| Command | What it does |
|---|---|
| `npm run deepcut -- list lakers` | Find prompts by id or text. |
| `npm run deepcut -- show pick-1` | Every valid answer for a prompt, grouped by tier. |
| `npm run deepcut -- player "Kwame Brown"` | Every prompt a player answers, with the tier. |
| `npm run deepcut -- tier pick-1 "Yao Ming" layup` | Set a tier (layup, toocute, midrange, three, logo, halfcourt). |
| `npm run deepcut -- halfcourt team-celtics "Pete Maravich"` | Hand-pick a Half-Court answer. |
| `npm run deepcut -- untier pick-1 "Yao Ming"` | Back to the automatic tier. |
| `npm run deepcut -- add <prompt> "<player>"` / `remove ...` | Fix the answer list. |
| `npm run deepcut -- disable <prompt>` / `enable ...` | Pull a prompt. Any scheduled day that used it gets a replacement automatically. |
| `npm run data:deepcut` | Rebuild after editing the JSON files by hand, and run the data checks. |

Tier and answer changes apply to live days right away (the next deploy). Player names are case- and accent-insensitive; when two players share a name, use the Basketball-Reference id (`ewingpa01`).
