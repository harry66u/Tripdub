# Starting Five (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the complete Starting Five daily game: real-stat player pool, wheel, slot placement with one re-spin, matchup sim vs. the Mystery Five, results, percentile, share, and a 2-year schedule.

**Architecture:** A Next.js App Router app. A pure-TypeScript engine (`src/games/starting-five/engine`) is shared by client and server. Daily runs go through three route handlers that hold the spin sequence server-side and pass HMAC-signed run tokens. Finished runs are written to Supabase `daily_results` through a secret-checked RPC, which also returns the percentile. Player data is generated offline by Python from Basketball-Reference CSVs into `src/data/sf-players.json`.

**Tech Stack:** Next.js 15 + React 19 + TypeScript, Tailwind CSS v4, `motion`, Fontsource fonts, `@supabase/supabase-js`, Vitest, Playwright (pre-installed Chromium), Python 3 (stdlib only) for the data pipeline.

**Spec:** `docs/superpowers/specs/2026-11-03-tripdub-design.md` (sections 3, 4, 10, 11, 12)

## Global Constraints

- The puzzle day resets at midnight **America/New_York**. Puzzle #1 = **2026-11-03**.
- Slots, in this order: `PG, SG, SF, PF, C`. Daily sequence = **6** players; **1** re-spin per game.
- **400** seeded sims per evaluation. Leaderboard score = win probability (0–100, one decimal); tiebreak = mean margin.
- The schedule generator fills **730** days ahead and never overwrites existing dates. No spin player repeats within **45** days.
- No logos, team marks, or player photos. Names, stats, and original graphics only. Credit Basketball-Reference on the About page.
- Future spins and the mystery team identity must never appear in a client payload before the run finishes.
- Gameplay input is tap/click/drag only. Every interactive element works with pointer events (mouse and touch) and keyboard.
- `prefers-reduced-motion`: the wheel jumps to the result after 300 ms with no rotation.

## Review Focus

1. **Midnight boundary.** A run started before reset and finished after it counts for the day it started (the date lives in the token). Test in Task 7.
2. **Reload mid-run.** The token and view persist in localStorage, and reloading resumes the same spin with the re-spin state intact. Test in Task 7 (replay) and Task 10 (Playwright reload).
3. **Double submit.** Calling finish twice returns the same result and writes one row (`unique(game, puzzle_date, device_id)`). Test in Task 9.
4. **Untracked stats.** For pre-1974 (no STL/BLK) and pre-1980 (no 3PT) players, ratings are never NaN and cards show "—". Test in Task 2 (pipeline asserts) and Task 6 (`formatLine`).
5. **Phone width.** At 375×667 the wheel, card, and five slots fit with no horizontal scroll, and drag-to-slot works by touch. Playwright check in Task 10.

---

### Task 1: Scaffold the app, tooling, and brand shell

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/about/page.tsx`, `src/components/brand/Logo.tsx`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `test`, `lint`, `data`, `schedule`, `schedule:check`, `puzzle`. CSS tokens on `:root`: `--ink`, `--ink-2`, `--paper`, `--amber`, `--signal`, `--court`, `--good`, `--bad`. The `font-display` (Big Shoulders Display) and `font-sans` (Barlow) utilities.

- [ ] Step 1: `npm init` the Next 15 app by hand (no network-dependent create-app). Install next, react, react-dom, typescript, tailwindcss@4, @tailwindcss/postcss, motion, @fontsource/big-shoulders-display, @fontsource/barlow, @fontsource/barlow-condensed, @supabase/supabase-js, vitest, @types/*.
- [ ] Step 2: Write `tests/smoke.test.ts` asserting `1 + 1 === 2` so the runner works. Run `npm test`; expect PASS.
- [ ] Step 3: Layout with brand header (logo with the triple-stripe mark), dark theme tokens, footer credits, and a placeholder home that links to `/starting-five`.
- [ ] Step 4: Run `npm run build`; expect success. Commit `chore: scaffold Next.js app and brand shell`.

### Task 2: Player data pipeline

**Files:**
- Create: `scripts/data/fetch.py` (downloads into `.data-cache/`, which is gitignored), `scripts/data/build_players.py`, `scripts/data/test_players.py`
- Output: `src/data/sf-players.json`

**Interfaces:**
- Produces: `sf-players.json` = `SFPlayer[]` matching `src/games/starting-five/types.ts` (Task 3).

`build_players.py` approach (decisions the implementer can't infer):
- NBA rows only (`lg == "NBA"`). For traded players use the `TOT` row when present (team `2TM`/`3TM`/`TOT`).
- Qualified season: MP ≥ 1000, or MP ≥ 700 in shortened seasons (1999, 2012, 2020, 2021).
- Prime = top 5 qualified seasons by WS (fewer if the career is shorter, minimum 2). Average minutes-weighted.
- Era-relative z-scores per season among that season's qualified players, then averaged over the prime and mapped to 0–99 by percentile within the pool, after clipping z to [-2.5, 3.5].
- Pool eligibility: at least 3 qualified seasons AND (All-Star ≥ 1 OR All-NBA ≥ 1 OR All-Defense ≥ 1 OR career WS ≥ 60 OR (career WS ≥ 35 and any season in the last 8 years)). Target 450–800 players.
- Missing-stat fallbacks follow the spec §4.2 table. Shot profile from `Player Shooting.csv` (rim = 0–3 ft, mid = 3 ft to the 3PT line, three = 3PA share). Before 1997: three = 3PA rate (0 before 1980), rim = clamp(0.25 + (heightIn − 78) × 0.03, 0.1, 0.6) of the remainder.
- Tier by `ovr` percentile: top 8% legend, next 22% allstar, next 40% starter, rest role.

- [ ] Step 1: Write `test_players.py` asserting: pool size in [450, 800]; every rating is an int in [0, 99]; no NaN; shot fractions sum to 1 ± 0.01; Stephen Curry `spc ≥ 95`; Shaquille O'Neal `reb ≥ 85` and `spc ≤ 25`; Magic Johnson `ply ≥ 95`; Bill Russell `rim ≥ 85` and `stl is None`; Dikembe Mutombo `rim ≥ 95`; Jerry West `spc` in [55, 85]; John Stockton `ply ≥ 95`; Michael Jordan tier `legend`.
- [ ] Step 2: Run `python3 -I scripts/data/test_players.py`; expect FAIL (no output file).
- [ ] Step 3: Implement fetch + build; run `npm run data`.
- [ ] Step 4: Re-run the tests; expect PASS. Commit `feat(data): Starting Five player pool from Basketball-Reference`.

### Task 3: Core libs: types, RNG, puzzle day

**Files:**
- Create: `src/games/starting-five/types.ts`, `src/lib/rng.ts`, `src/lib/day.ts`
- Test: `tests/lib/rng.test.ts`, `tests/lib/day.test.ts`

**Interfaces:**
- Produces:
  - `type Slot = 'PG'|'SG'|'SF'|'PF'|'C'`; `const SLOTS: readonly Slot[]`
  - `SFPlayer { id; name; pos; heightIn; prime:{from,to}; tier:'legend'|'allstar'|'starter'|'role'; ovr; era; line:{pts,reb,ast,stl|null,blk|null,fg3Pct|null,fg3a|null,ftPct|null,tsPct|null}; r:{sco,ply,reb,per,rim,spc}; shot:{rim,mid,three}; usg; acc:{mvp,allStar,allNba,allDef,dpoy,hof} }`
  - `rng(seed: number): () => number` (sfc32, output in [0,1)); `hashSeed(...parts: (string|number)[]): number` (32-bit FNV-1a)
  - `puzzleDate(now?: Date): string` ('YYYY-MM-DD' in America/New_York); `nextResetAt(now?: Date): Date`; `puzzleNumber(date: string): number` (2026-11-03 → 1); `addDays(date: string, n: number): string`

- [ ] Step 1: Tests: `rng(42)` yields the same first 3 values twice, and all values are in [0,1). `puzzleDate(new Date('2026-11-04T04:59:00Z')) === '2026-11-03'`. `puzzleDate(new Date('2026-11-04T05:00:00Z')) === '2026-11-04'` (EST). A DST case: `puzzleDate(new Date('2027-07-01T03:59:00Z')) === '2027-06-30'`. `nextResetAt(new Date('2026-11-03T15:00:00Z')).toISOString() === '2026-11-04T05:00:00.000Z'`. `puzzleNumber('2026-11-03') === 1`.
- [ ] Step 2: Run `npx vitest run tests/lib`; expect FAIL. Implement using `Intl.DateTimeFormat` with `timeZone: 'America/New_York'`. Run again; expect PASS. Commit.

### Task 4: Lineup grades and archetypes

**Files:**
- Create: `src/games/starting-five/engine/grades.ts`, `src/games/starting-five/engine/archetype.ts`
- Test: `tests/sf/grades.test.ts`

**Interfaces:**
- Consumes: `SFPlayer`, `Slot`.
- Produces:
  - `type Grades = { sco: number; def: number; reb: number; spc: number; ply: number; overall: number }` (each 0–100)
  - `gradeLineup(players: SFPlayer[]): Grades`, using the weights in spec §4.3. Defense = 0.5 × weighted top-3 `per` + 0.5 × max `rim`. Spacing = mean over players of `sigmoid((spc − 55) / 8) × 100`. Overall = 0.24 sco + 0.22 def + 0.16 reb + 0.18 spc + 0.20 ply.
  - `letter(grade: number): string` (A+ ≥ 93, A ≥ 86, A- ≥ 80, B+ ≥ 75, B ≥ 70, B- ≥ 65, C+ ≥ 60, C ≥ 55, C- ≥ 50, D ≥ 40, else F)
  - `archetype(p: SFPlayer): string`, one of: Floor General, Sharpshooter, Slasher, Two-Way Wing, Rim Protector, Glass Cleaner, Stretch Big, Point Forward, Bucket Getter, Lockdown Defender, chosen from the top rating pattern.
  - `clueFor(p: SFPlayer): { era: string; archetype: string }` (era = decade of prime midpoint, for example "1990s")

- [ ] Step 1: Tests built from fixture players (made with a `fixturePlayer(overrides)` helper in `tests/sf/fixtures.ts`): a lineup with no `ply ≥ 70` player has lower `ply` than the same lineup with one swapped for a `ply: 95` player. A lineup with max `rim` 30 has lower `def` than one with a `rim: 95` player. 5 players with `spc: 85` get higher `spc` than 2 shooters and 3 with `spc: 20`. All grades are within [0, 100]. `archetype` of a `{ply:97, sco:80}` guard is "Floor General".
- [ ] Step 2: Run, expect FAIL. Implement. Run, expect PASS. Commit.

### Task 5: Matchup simulation and evaluation

**Files:**
- Create: `src/games/starting-five/engine/sim.ts`
- Test: `tests/sf/sim.test.ts`

**Interfaces:**
- Consumes: `rng`, `hashSeed`, `gradeLineup`.
- Produces:
  - `type Lineup = Record<Slot, SFPlayer>`
  - `type PlayerBox = { pts; reb; ast; stl; blk; fgm; fga; fg3m; fg3a; ftm; fta; tov }`
  - `type TeamBox = { score: number; quarters: number[]; players: Record<Slot, PlayerBox> }`
  - `type GameResult = { home: TeamBox; away: TeamBox; leadChanges: number; biggestLead: { side: 'home'|'away'; pts: number } }`
  - `simulateGame(home: Lineup, away: Lineup, seed: number): GameResult`
  - `type Evaluation = { winProb: number; meanMargin: number; sdMargin: number; featured: GameResult; featuredSeed: number }`
  - `evaluateMatchup(home: Lineup, away: Lineup, baseSeed: number, n = 400): Evaluation`

Sim model (the decisions):
- 4 quarters × 25 possessions per side (alternating), plus overtime periods of 6 possessions until untied.
- On offense, the shooter is chosen by weight `usg × (0.6 + sco/100)`, with a turnover chance of `0.16 − 0.06 × teamPly/100` (assigned to the ballhandler by weight).
- Shot type is drawn from the shooter's `shot` profile, tilted toward threes by team spacing.
- Make probability base by type: rim 0.62, mid 0.41, three 0.355. Adjustments, in percentage points: shooter quality (+0.12 × (sco−50)/50 for rim/mid; +0.14 × (spc−50)/50 for threes); the matched defender (−0.08 × (per−50)/50 on mid/three; −0.10 × (rim−50)/50 on rim, where the "rim" defender is 0.6 matched + 0.4 best team rim protector); team spacing (+0.03 × (spc−50)/50 on rim); team playmaking (+0.02 × (ply−50)/50 on all).
- Foul chance 0.09 on rim shots (2 FTs at the shooter's FT ≈ 0.55 + 0.35 × spc/100).
- Offensive rebound chance `0.27 + 0.10 × (offReb − defReb)/100`; the rebounder is chosen by weight `reb²`. An assist is credited on 60% of made shots to a weighted teammate (`ply²`). A block is credited on 40% of missed rim shots to the matched defender or the help defender (weight `rim²`). A steal is credited on 50% of turnovers to a defender (weight `per²`).
- Matchup defender = opponent player in the **same slot**.

- [ ] Step 1: Tests. Same inputs give the same result (deep equal). The sum of player `pts` equals the team `score`. Scores fall within [70, 160] across 50 seeds. A strong lineup (all ratings 85) vs. a weak one (all 40) has `winProb > 0.9`. Identical lineups have `winProb` in [0.4, 0.6]. **Matchup sensitivity:** home = 4 average players + one `rim:98, per:20` center, away has an elite `spc:99` shooter at PG; putting the center at PG vs. at C changes `meanMargin` by ≥ 1.5 points. `featured` is the sim whose margin is closest to the median, and `sign(featured margin) === sign(meanMargin)` whenever `|meanMargin| > 2`.
- [ ] Step 2: Run, expect FAIL. Implement. Run, expect PASS. Also check that `evaluateMatchup` with n = 400 runs in < 150 ms in Node. Commit.

### Task 6: Summary, formatting, share text

**Files:**
- Create: `src/games/starting-five/engine/summary.ts`, `src/games/starting-five/engine/format.ts`, `src/games/starting-five/engine/share.ts`
- Test: `tests/sf/summary.test.ts`

**Interfaces:**
- Produces:
  - `summarize(ev: Evaluation, home: Lineup, away: Lineup, labels: { home: string; away: string }): string` (3–4 sentences: the result line with score, the top performer, the key matchup (the slot with the largest scoring differential), and the deciding dimension (the largest grade gap, or 3PM gap))
  - `formatLine(line: SFPlayer['line']): { label: string; value: string }[]` (null shows as "—"; percentages as ".412")
  - `shareText(r: { puzzleNumber: number; won: boolean; homeScore: number; awayScore: number; winProb: number; grades: Grades; percentile: number | null }): string` matching spec §10. Grade emoji: ≥ 80 🟩, ≥ 65 🟨, ≥ 50 🟧, else 🟥. The URL line comes from `NEXT_PUBLIC_SITE_URL` (default `tripdub.app`).

- [ ] Step 1: Tests. The summary contains both scores and the top scorer's name, and has between 3 and 4 sentences. `formatLine` with `stl: null` gives a "STL" entry with "—". The share text contains no player names (assert none of the 10 lineup names appear) and starts with `TRIPDUB · Starting Five #`.
- [ ] Step 2: Run, expect FAIL. Implement. Run, expect PASS. Commit.

### Task 7: Run state machine and signed tokens

**Files:**
- Create: `src/games/starting-five/engine/run.ts`, `src/lib/server/token.ts`
- Test: `tests/sf/run.test.ts`, `tests/lib/token.test.ts`

**Interfaces:**
- Produces:
  - `type Action = { t: 'place'; slot: Slot } | { t: 'respin' }`
  - `type RunView = { index: number; currentId: string | null; lineup: Partial<Record<Slot, string>>; respinsLeft: number; done: boolean }`
  - `replay(sequence: string[], actions: Action[]): RunView` (throws `RunError` for: placing into a filled slot, a second re-spin, any action after done, or running out of sequence)
  - `signToken(payload: object, secret: string): string`, `verifyToken<T>(token: string, secret: string): T | null` (HMAC-SHA256, base64url, constant-time compare, node:crypto)
  - `type RunToken = { v: 1; date: string; device: string; actions: Action[] }`

- [ ] Step 1: Tests. Empty actions give index 0 and respinsLeft 1. Respin then 5 places gives done, and the lineup uses sequence ids [1..5]. A second respin throws. Placing into a filled slot throws. A token round-trips. A tampered payload (one changed character) returns null. A token with a date from yesterday still verifies (the date is preserved, so the midnight-boundary case works).
- [ ] Step 2: Run, expect FAIL. Implement. Run, expect PASS. Commit.

### Task 8: Puzzle generator and schedule tooling

**Files:**
- Create: `src/games/starting-five/server/data.ts` (server-only loader for the pool by id), `src/games/starting-five/server/generate.ts`, `src/games/starting-five/server/puzzle.ts`, `scripts/schedule/generate.ts`, `scripts/schedule/check.ts`, `scripts/schedule/puzzle.ts`, `content/schedule/starting-five.json`, `content/README.md`
- Test: `tests/sf/generate.test.ts`

**Interfaces:**
- Produces:
  - `type SFPuzzle = { spins: string[]; mystery: Record<Slot, string>; theme: string }`
  - `generateSFPuzzle(date: string, pool: SFPlayer[], recentSpinIds: Set<string>): SFPuzzle`. Deterministic from `hashSeed('sf', date)`. Spin tier mix is sampled per spin with weights legend 0.12 / allstar 0.33 / starter 0.40 / role 0.15. The Mystery Five comes from a theme rotation of 8 themes (for example "All-Time Legends", "90s Bruisers", "Splash Era", "Twin Towers", "Showtime Speed", "Defense Wins", "Old School", "Positionless"). Each theme is a filter plus a slot-fit rule, and mystery players are always legend or allstar.
  - `getSFPuzzle(date: string): SFPuzzle` (schedule file entry, else the generator)
  - CLI: `npm run schedule [-- --days 730]`, `npm run schedule:check`, `npm run puzzle -- show <date>`, `npm run puzzle -- set <date> --spins "Name,Name,..." [--mystery "PG:Name,..."]`, `npm run puzzle -- reroll <date>` (names resolve to ids, case-insensitive, accent-insensitive)

- [ ] Step 1: Tests. Generation is deterministic for a date. 6 distinct spins. Mystery has 5 distinct players, disjoint from the spins. Across 120 consecutive generated days with a rolling 45-day window, no spin id repeats inside the window. `check` returns no errors on the generated file, and reports an error for an unknown id.
- [ ] Step 2: Run, expect FAIL. Implement. Run `npm run schedule` (730 days from 2026-11-03) then `npm run schedule:check`; expect "OK". Commit (including the schedule JSON).

### Task 9: Daily API and Supabase results

**Files:**
- Create: `supabase/migrations/0001_daily_results.sql`, `src/lib/server/db.ts`, `src/app/api/sf/daily/start/route.ts`, `src/app/api/sf/daily/step/route.ts`, `src/app/api/sf/daily/finish/route.ts`, `src/games/starting-five/server/finish.ts`
- Test: `tests/sf/api.test.ts`

**Interfaces:**
- DB: `daily_results(id, game, puzzle_date, device_id, user_id null, score float8, tiebreak float8, detail jsonb, created_at, unique(game, puzzle_date, device_id))` with RLS enabled (authenticated can select own rows). `private.server_config(secret_hash text)`. RPC `record_daily_result(p_secret, p_game, p_date, p_device, p_score, p_tiebreak, p_detail) returns jsonb {percentile, total}` (security definer, checks sha256 of the secret, `on conflict do nothing`, percentile = share of rows with a lower score, ties counting half). RPC `daily_percentile(p_game, p_date, p_score)` is public.
- `db.ts`: `recordDailyResult(input): Promise<{ percentile: number; total: number } | null>` (returns null when env is unset)
- API (JSON, POST):
  - `start {device}` → `{ date, puzzleNumber, theme, clues: Record<Slot,{era,archetype}>, token, view: RunView, current: SFPlayer, nextResetAt }`
  - `step {token, action}` → `{ token, view, current: SFPlayer | null, lineup: Partial<Record<Slot, SFPlayer>> }` (400 on `RunError` or a bad token)
  - `finish {token}` → `SFResult = { date, puzzleNumber, lineup: Lineup, mystery: Lineup, theme, grades, mysteryGrades, winProb, meanMargin, featured: GameResult, summary, percentile: number | null, total: number | null, share }`
- `finishRun(token: RunToken): SFResult` (pure, used by the route and by tests; the eval seed is `hashSeed('sf-eval', date, lineup ids)`)

- [ ] Step 1: Tests (call route handlers directly with `new Request`, using a mocked `db.ts`). `start` returns no field containing any id from spins[1..5] or the mystery team (stringify the JSON and search). `step` with a respin returns a different current player. `finish` before 5 places returns 400. `finish` twice returns identical `winProb` and calls `recordDailyResult` with the same args (the DB unique key makes the second call a no-op).
- [ ] Step 2: Run, expect FAIL. Implement. Run, expect PASS.
- [ ] Step 3: Apply the migration via the Supabase MCP, seed `private.server_config` with the sha256 of a generated secret, run `get_advisors(security)`, and fix any findings. Commit.

### Task 10: Starting Five UI

**Files:**
- Create: `src/app/starting-five/page.tsx`, `src/app/api/sf/names/route.ts`, `src/components/starting-five/{Game.tsx, Wheel.tsx, PlayerCard.tsx, LineupBoard.tsx, MysteryBoard.tsx, ResultView.tsx, GradeBars.tsx, BoxScore.tsx, ShareButton.tsx}`, `src/lib/client/{device.ts, storage.ts, share.ts}`, `tests/e2e/starting-five.spec.ts`

**Interfaces:**
- Consumes: the Task 9 API and the Task 6 `formatLine`/`letter`.
- `Wheel`: props `{ names: string[]; targetIndex: number; tiers: SFPlayer['tier'][]; spinning: boolean; onDone(): void }`. SVG wheel with 16 segments and a tick pointer. Spin = 4.2 s with a custom ease (fast start, long tail), 5–7 full turns plus the target angle. The last 600 ms crawl past the final 2 segments. Tick sounds are optional (off by default). Reduced-motion rule from Global Constraints.
- Decoy names: the page fetches `/api/sf/names` (all pool names and tiers, no stats). The client builds the 16 segments from 15 decoys plus the current player.
- State persistence: `localStorage['tripdub:sf:daily:<date>'] = { token, view, current, lineup, result? }`.
- Placement: tap a card then tap a slot, or drag the card onto a slot (pointer events). Filled slots show the player and a lock icon.

- [ ] Step 1: Build the components. Invoke the `frontend-design` skill for the visual pass.
- [ ] Step 2: Playwright `tests/e2e/starting-five.spec.ts` at 1440×900 and 375×667: start → spin → place ×5 (using a respin once) → simulate → results show a final score and a share button. Reload mid-run resumes at the same spin. `document.documentElement.scrollWidth <= innerWidth` at 375. Save screenshots to the scratchpad.
- [ ] Step 3: Run `npm run build` and `npx playwright test`; expect PASS. Commit.

### Task 11: Wrap-up

- [ ] Step 1: The About page has data credits and the methodology (the ratings explained in plain language).
- [ ] Step 2: Run `npm test`, `npm run build`, `npm run schedule:check`, and the e2e suite; all pass.
- [ ] Step 3: Push the branch, open a PR, and report what's done and what I need next (Google OAuth, the Vercel project).
