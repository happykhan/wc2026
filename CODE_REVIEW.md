# Thermo-Nuclear Code Quality Review — wc2026

Scope: the live-data / clock / theme / settings work merged today, plus the
structural health of the files that work touched. Strict maintainability lens:
ambitious restructuring, delete complexity, no spaghetti growth, no >1k files.

Verdict: **changes are behaviourally correct but sit on top of real structural
debt.** Three presumptive blockers below. None are "rename this" nits.

---

## 1. BLOCKER — `api/poll.ts` (340 lines) is dead code still deployed

The whole live-scores cache moved to the VM (`scripts/vm-poller.mjs` →
`wc-scores.genomicx.org` → `/api/scores` proxies it). `api/poll.ts` is no longer
triggered by anything: the cron line is gone, `/api/scores` no longer reads Blob,
nothing imports it. The only remaining reference is `scripts/test-cache.mjs`
asserting it returns 401.

It still ships 340 lines of duplicated ESPN-merge logic **and its own copy of the
team-alias map** (see #2), plus the Vercel Blob write path that caused the quota
incident.

**Code-judo (delete a whole layer):** remove `api/poll.ts`, drop the dead Blob
store, delete the `/api/poll` assertions from `test-cache.mjs`. This deletes one
of four alias copies, an entire duplicate of the merge logic, and the last Blob
dependency — in one move. Highest value, lowest risk on the list.

---

## 2. BLOCKER — the team-alias map is redefined in 4 places

`normTeam` + `TEAM_ALIASES` is the single most bug-prone primitive in the app
(the Czechia/Cape Verde/Curaçao score-merge failures all came from one copy
missing an alias). It currently lives in **four** independent definitions:

- `src/data/teamMatch.ts`  ← canonical; correctly imported by `useLiveScores`,
  `MatchRow`, and the integrity test
- `api/poll.ts`            ← dead (see #1), delete
- `api/share.ts`           ← live, hand-maintained copy
- `scripts/vm-poller.mjs`  ← live, hand-maintained copy (the one that actually
  drives production scores)

This is exactly "copy-pasted logic instead of a canonical helper." The runtime
split is real (`src` is bundled, `scripts/*.mjs` runs raw on the VM, `api/*` is
serverless) — but that's an argument for **one shared data source**, not four
hand-edited maps that silently drift.

**Remedy:** make the alias map the single source of truth as plain data
(`src/data/teamAliases.json` or a tiny `.mjs`), and have `teamMatch.ts`,
`vm-poller.mjs`, and `api/share.ts` all import it. Then add a test asserting the
production-critical consumers fold a known set of variants identically. After #1,
this collapses 3 live copies → 1.

---

## 3. BLOCKER — `MatchRow.tsx` is 1098 lines and is the god-file

It was edited **10 times today** and is the file most likely to keep breaking. It
holds ~11 concerns: ICS helpers, `StatusBadge` + the live-clock math,
`TeamNameInline`, `CountdownInline`, `ShareButton`, `CopyButton`, `useMatchDetail`,
and four detail panels (`H2H`, `Lineups`, `Stats`, `Timeline`), then the row
itself. Anything that touches the card reloads all of it.

**Decomposition (behaviour-preserving):**
- `src/components/matchDetail/` ← the 4 panels + `useMatchDetail` (~410 lines out)
- `src/components/StatusBadge.tsx` + `src/utils/liveClock.ts` ← the badge and the
  clock extrapolation (see #4)
- `src/components/matchActions/` ← Share/Copy/ICS buttons

That leaves `MatchRow` ≈ 550 lines of actual row layout. Each extracted unit
becomes independently testable — which matters most for the clock.

---

## 4. The live-clock math is untested logic buried in a component

`MatchRow.tsx:110-111`:
```
const ext = Math.min(Math.max(0, Date.now() - minuteAt), 900_000);
const sec = Math.round(minute * 60 + ext / 1000 + 30);
```
This expression had **three** production bugs this session (trailed the TV clock,
sawtoothed backwards in stoppage, ran past full-time). It is pure and trivial to
test, but it lives inline in a 1098-line component with `Date.now()` baked in, so
it never got a test.

**Remedy:** extract `liveClockLabel({ status, minute, minuteAt, now })` to
`src/utils/liveClock.ts` and unit-test the three regressions explicitly:
ticks forward, never decreases while `minute` plateaus, caps at the 15-min ceiling.
This is the single highest-value missing test in the codebase.

---

## 5. `mapStatus` hides a magic-number special case (untested)

`useLiveScores.ts:66` maps `IN_PLAY` with `minute ∈ [45,50]` to `ht`. That's an
ad-hoc heuristic that also mislabels the genuine 46–50' of the second half as
half-time. The real signal already exists upstream — ESPN's `STATUS_HALFTIME` is
mapped to `PAUSED` by the poller. So the `[45,50]` guess is papering over a
boundary that's already explicit one layer up.

**Remedy:** trust `PAUSED → ht` and drop the minute-range guess (or, if it's
catching a real gap, make that gap explicit and test it). Either way: add a
`mapStatus` unit test — it's a pure function with zero coverage.

---

## 6. Poller helpers are pure but live in an untestable `.mjs`

`vm-poller.mjs` carries the logic that actually breaks in production: `espnStatus`
(the full-time mapping), the ESPN US-local date ±1 fetch, the `minuteAt`
minute-change anchor, and the carry-forward block (a dense stack of
`priorResult/currentBlank/justEnded/haveFinal/haveEspn` booleans). It's a raw node
script with no tests, so every fix here has been verified by hand against a live
match.

**Remedy:** split the pure helpers (`espnStatus`, `espnMinute`, `neededEspnDates`,
the carry-forward reducer) into a `.mjs` module importable by both the poller and
a vitest suite. Test: `STATUS_FULL_TIME → FINISHED`, a 01:00 UTC kickoff yields
the previous US date, and carry-forward never erases a seen score.

---

## Lower-priority / type-boundary notes

- `api/matchdetail.ts` parses ESPN/AFL with ~10 `any`/cast sites. A small typed
  boundary (parse → narrow shape once) would remove the scattered casts. Not a
  blocker, but it's the loosest contract in the API layer.
- The 8 obsolete `theme*` i18n keys (`themeRedWhite`, …) are now unreferenced
  after the team-theme rewrite — delete them from all four locale files.
- `THEMES` now has a per-team entry for all 48 nations but there's no test that
  every fixture team resolves to a non-`default` theme (the same class of gap the
  channel test already guards). Add it — one assertion, prevents a silent
  "everyone's blue" regression.

---

## Prioritised action list

1. Delete `api/poll.ts` + dead Blob + its test assertions (#1) — pure deletion.
2. Single-source the alias map; import everywhere (#2).
3. Extract + test `liveClockLabel` (#4) and `mapStatus` (#5).
4. Decompose `MatchRow.tsx` under 1k (#3).
5. Extract + test poller pure helpers (#6).
6. Tidy: matchdetail types, dead i18n keys, theme-coverage test.
