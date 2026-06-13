import { describe, it, expect } from 'vitest';
import { processedMatches } from './processFixtures';
import index from '../../public/match-index.json';

// scripts/gen-match-index.mjs replicates the id logic in processFixtures.ts to
// build the static share-index. This guards that duplication: every real match id
// must be present with matching teams, so a clean /match/<id> link always resolves.
const idx = index as Record<string, { h: string; a: string; s: string; d: string; v: string }>;

describe('match-index (clean share-URL resolution)', () => {
  it('covers every match id with matching teams', () => {
    for (const m of processedMatches) {
      const entry = idx[m.id];
      expect(entry, `missing id ${m.id}`).toBeTruthy();
      expect(entry.h, `home for ${m.id}`).toBe(m.team1);
      expect(entry.a, `away for ${m.id}`).toBe(m.team2);
    }
  });

  it('resolves m8 to Qatar vs Switzerland (the reported link)', () => {
    expect(idx.m8).toMatchObject({ h: 'Qatar', a: 'Switzerland', s: 'Group B' });
  });
});
