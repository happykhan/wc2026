import { describe, it, expect } from 'vitest';
import { processedMatches } from './processFixtures';
import index from '../../public/match-index.json';

// scripts/gen-match-index.mjs builds the static share-index from the shared
// fixtures lib (scripts/fixturesLib.mjs); processFixtures.ts is the TS copy of
// the same id + kickoff-parse logic. This guards that they agree: every real
// match id must be present with matching teams AND the same kickoff DATE — so a
// drift in the (still-duplicated) TS date parser would fail the build, not show
// up as a wrong preview date in production. (#1 in CODE_REVIEW.md.)
const idx = index as Record<string, { h: string; a: string; s: string; d: string; v: string }>;

// Same formatting gen-match-index.mjs applies to the parsed kickoff Date.
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);

describe('match-index (clean share-URL resolution)', () => {
  it('covers every match id with matching teams and the same kickoff date', () => {
    for (const m of processedMatches) {
      const entry = idx[m.id];
      expect(entry, `missing id ${m.id}`).toBeTruthy();
      expect(entry.h, `home for ${m.id}`).toBe(m.team1);
      expect(entry.a, `away for ${m.id}`).toBe(m.team2);
      // Closes the gap where the build-time and app-time date parsers could drift.
      expect(entry.d, `date for ${m.id}`).toBe(fmtDate(m.utcDate));
    }
  });

  it('resolves m8 to Qatar vs Switzerland (the reported link)', () => {
    expect(idx.m8).toMatchObject({ h: 'Qatar', a: 'Switzerland', s: 'Group B' });
  });
});
