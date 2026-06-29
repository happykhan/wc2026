# Thermo-Nuclear Code Quality Review — PR #28

Scope: branch `fix-path-journey`, covering bracket path traversal, knockout
source-slot preservation after live-score merges, and the path-panel copy.

Verdict: **no structural blocker remains on this branch after the current
cleanup.** The important code-quality move was to stop letting mutable display
team names leak into canonical bracket-routing logic.

## Findings

### 1. Fixed — bracket routing no longer depends on mutated display labels

Before this pass, the app merged live team names into knockout matches and then
rebuilt bracket structure from those mutated objects. That broke two canonical
flows:

- third-place allocation, which needs the original `1L` / `1G` / `1B` slot
  codes, not `England` / `Belgium` / `Switzerland`
- path traversal, which needs `W73`-style source slots to keep walking forward

The branch now preserves the original fixture slots at the resolver boundary:

- `resolveKnockoutMatchTeams(scoredMatches, processedMatches)`
- `buildBracket(matches, processedMatches)`

That is the right ownership line. The canonical bracket logic works from the
canonical fixture sources again; display-name overlays stay a presentation
concern.

### 2. Fixed — path traversal is now a dedicated pure module

`src/data/bracketPath.ts` owns the path walk instead of leaving that traversal
embedded in `src/pages/Bracket.tsx`.

That is the correct decomposition for this feature:

- the UI renders the path
- the pure helper decides how to walk backward to the earliest linked knockout
  match and forward until elimination or the last reachable round

This keeps the page component from accumulating tournament-graph logic inline.

### 3. Fixed — all-groups-complete third-place fixtures are no longer mislabeled as projected

The prior rule only marked a third-place assignment final if it was stable
across every allocation table. That is too conservative once the whole group
stage is finished. The branch now treats resolved third-place opponents as final
when all groups are complete.

That removes an incorrect state rather than adding more branchiness elsewhere.

## Open Questions / Residual Risk

None at blocker level.

The remaining coupling is acceptable for this branch:

- `processedMatches` is still the canonical source of fixture-slot truth
- both `App.tsx` and `Bracket.tsx` now pass it explicitly to bracket helpers

The cleaner long-term model would be to carry immutable knockout source slots on
the `Match` model itself, so the canonical source survives all display merges
without needing a second argument. That is a larger type-boundary change, not a
requirement for this PR.

## Tests / Verification

- `src/data/bracketPath.test.ts`
  - still-in-contention path shows the full chain
  - knocked-out path stops at elimination
- `src/data/bracket.test.ts`
  - preserves original knockout source slots after partial live-name resolution
  - covers the England / Belgium / Switzerland class of failures
- `npm run build`
  - green, 23 test files / 164 tests

## Approval Bar

Approved from a maintainability standpoint for PR #28 after the current fixes:

- no file-size regression
- no new spaghetti branch growth in the UI layer
- canonical routing logic moved back behind pure data helpers
- path behavior is covered by targeted tests
