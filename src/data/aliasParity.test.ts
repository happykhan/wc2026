import { describe, it, expect } from 'vitest';
import { TEAM_ALIASES, normTeam } from './teamMatch';
import { TEAM_ALIASES as POLLER_ALIASES, norm as pollerNorm } from '../../scripts/pollerLib.mjs';

// The team-alias map is mirrored across two runtimes: the bundled frontend
// (teamMatch.ts) and the raw-node VM poller (pollerLib.mjs). They cannot share a
// module, so this test fails the build if they ever drift — the exact class of
// bug that caused the Czechia / Cape Verde score-merge failures.
describe('team-alias parity across runtimes', () => {
  it('the frontend and poller alias maps are identical', () => {
    expect(POLLER_ALIASES).toEqual(TEAM_ALIASES);
  });

  it('both implementations normalise the same way', () => {
    for (const name of ['Czech Republic', 'Cape Verde Islands', 'United States', 'Curaçao', "Côte d'Ivoire", 'Brazil']) {
      expect(pollerNorm(name)).toBe(normTeam(name));
    }
  });
});
