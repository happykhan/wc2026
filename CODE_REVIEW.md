# Thermo-Nuclear Code Quality Review — PR #21

Scope: the current branch `codex/resolve-third-place-knockout-fixtures`, covering
Round-of-32 slot resolution, projected-fixture warnings, `/match/:id` share
metadata, README/notes updates, and regression coverage.

Verdict: **behavior is on the right track and the branch is shippable after the
small cleanup already applied in this review pass.** The important fix was
removing the simplified standings duplicate from `api/share.ts`; it now reuses
the canonical `computeStandings`, so share previews cannot silently disagree
with the UI on FIFA tiebreakers.

## Findings

### 1. P2 — Slot resolution still has two orchestration paths

`src/data/bracket.ts` owns the frontend resolver, while `api/share.ts` has a
smaller server-side resolver for metadata. They now share the third-place table
and `computeStandings`, but the orchestration is still duplicated: fetch/group
matches, build group results, rank thirds, resolve `1A`/`3A/B/...` slots.

This is not a release blocker because the API build gate catches unsafe imports
and the new tests cover the high-risk allocation row. It is still the main
structural weakness in this branch.

Best next code-judo move: extract an API-safe pure module, for example
`src/data/knockoutSlots.ts`, that accepts:

- group standings/results
- a home slot
- an away slot
- third-place assignment data

and returns `{ team1, team2, projected }`. Then both `bracket.ts` and
`api/share.ts` become thin adapters around the same resolver. That would delete
the duplicated regex/assignment flow rather than polishing it.

### 2. P2 — Projection semantics are implicit and deserve a dedicated model

The current `projected` flag is correct for the current behavior: unfinished
group slots and unstable third-place allocation show the warning icon; final
fixtures do not. The logic is spread across `groupComplete`,
`isThirdPlaceAssignmentStable`, and `projectedKnockoutTeams`.

This works, but the concept is important enough to model explicitly. A small
type like `ResolvedSlot = { label; status: 'placeholder' | 'projected' | 'final' }`
would make the UI rule and share-preview behavior clearer than a boolean that
has to be interpreted in context.

### 3. P3 — `thirdPlaceAllocation.ts` is data with no source marker beyond comments

The allocation table is compact and now tested for shape and the current
`ABDEFGIL` examples. The remaining maintainability risk is provenance: if FIFA
or the source table changes, the code has no machine-readable snapshot metadata.

Add a source/date note near the table when the table is next refreshed. If the
full 495-row allocation table becomes necessary, generate this file from a
checked-in source fixture rather than hand-maintaining rows.

### 4. P3 — Browser/UI verification is manual, not part of CI

The PR has good unit coverage for resolver behavior, but the "warning icon is
icon-only, not text" requirement was verified with Playwright manually. That is
fine for this release, but a tiny Playwright smoke test could prevent the chip
from regressing into visible text.

Keep it lightweight: one mocked `/api/scores` payload, load bracket, assert a
`[aria-label="As it stands"]` warning exists and visible body text does not
contain `AS IT STANDS`.

## Tests Added / Strengthened

- `src/data/bracket.test.ts`
  - final group slots resolve without projection
  - current unfinished group standings resolve with `projected: true`
  - Germany vs Paraguay and Argentina vs Cape Verde are covered
- `src/data/thirdPlaceAllocation.test.ts`
  - assignment table shape
  - current `ABDEFGIL` allocation examples
  - stable-vs-unstable assignment detection
- `npm run build` now exercises API type-checking, so unsafe serverless imports
  fail before Vercel deploys.

## Additional Fast Regression Opportunities

1. Add a focused test for Group J/K/L completion: when a group flips from 4/6
   finished to 6/6 finished, the same resolved fixture keeps the same teams but
   `projected` flips from `true` to `false`.
2. Add a test for `/api/share` resolver behavior if it is extracted into an
   API-safe pure module; this would cover metadata without invoking Vercel.
3. Add a generated table-integrity test if more third-place rows are added:
   every assignment value must be one of the advancing groups and every required
   first-place slot must be present.

## File Size / Decomposition

No file crossed the 1000-line threshold. The largest touched file remains
`src/components/MatchRow.tsx` at roughly 630 lines. This branch only adds a
small icon and does not worsen the component's overall shape materially.

## Approval Bar

Approved from a maintainability standpoint for this branch after the cleanup:

- canonical standings are reused by `/api/share`
- third-place table lookup/stability is centralized
- regression tests cover the risky cases
- projected UI is compact and accessible
- no large-file or broad spaghetti growth

The next meaningful cleanup is to extract an API-safe pure knockout slot
resolver so frontend and share metadata cannot drift.
