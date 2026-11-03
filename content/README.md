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

Names are case- and accent-insensitive ("nikola jokic" works). Basketball-Reference ids (`jokicni01`) work too. Only players in `src/data/sf-players.json` can be used; that file is rebuilt with `npm run data`.

## Starting Five format

```json
"2026-12-25": {
  "spins": ["id1", "id2", "id3", "id4", "id5", "id6"],
  "mystery": { "PG": "id", "SG": "id", "SF": "id", "PF": "id", "C": "id" },
  "theme": "Christmas Classics"
}
```

You can also edit the JSON directly, for example in GitHub's web editor. Commit the change and the next deploy picks it up.
