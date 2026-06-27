# Thermo-Nuclear Code Quality Review — PR #21

Scope: the current branch `codex/resolve-third-place-knockout-fixtures`, covering
Round-of-32 slot resolution, projected-fixture warnings, `/match/:id` share
metadata, README/notes updates, and regression coverage.

Verdict: **behavior is on the right track and the branch is shippable after the
cleanup applied in this review pass.** The important fixes were removing the
simplified standings duplicate from `api/share.ts`, extracting shared knockout
slot resolution into an API-safe pure module, and making slot finality explicit.

## Findings

### 1. Fixed — Slot resolution now has one shared pure path

`src/data/knockoutSlots.ts` now owns group-slot, third-place-slot, and
projected/final resolution. `src/data/bracket.ts` and `api/share.ts` are thin
adapters around the same resolver, so share metadata and the UI cannot drift on
FIFA tiebreakers or third-place allocation.

### 2. Fixed — Projection semantics are explicit

The resolver now returns
`ResolvedSlot = { label; status: 'placeholder' | 'projected' | 'final' }`.
The bracket UI derives its warning icon from that status instead of interpreting
several booleans spread across the call path.

### 3. P3 — `thirdPlaceAllocation.ts` is still hand-maintained data

The allocation table is compact and now tested for shape and the current
`ABDEFGIL` examples. It also has a source/date comment. The remaining
maintainability risk is that it is still hand-maintained.

If the full 495-row allocation table becomes necessary, generate this file from
a checked-in source fixture rather than hand-maintaining rows.

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
- `src/data/knockoutSlots.test.ts`
  - shared group-slot resolver behavior
  - projected-to-final transition when a group completes without changing teams
- `npm run build` now exercises API type-checking, so unsafe serverless imports
  fail before Vercel deploys.

## Additional Fast Regression Opportunities

1. Add a tiny Playwright smoke test for the icon-only projected fixture UI.
2. Add a direct `/api/share` handler test if share previews need more coverage
   than the shared pure resolver gives us.
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
- knockout slot resolution and third-place table lookup/stability are centralized
- regression tests cover the risky cases
- projected UI is compact and accessible
- no large-file or broad spaghetti growth
