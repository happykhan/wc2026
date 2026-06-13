import { describe, it, expect } from 'vitest';
import { TEAM_ALIASES, normTeam } from './teamMatch';
import { TEAM_ALIASES as POLLER_ALIASES, norm as pollerNorm } from '../../scripts/pollerLib.mjs';
import { TEAM_ALIASES as SHARE_ALIASES } from '../../api/share';

// The team-alias map is mirrored across three runtimes that can't share a module:
// the bundled frontend (teamMatch.ts), the raw-node VM poller (pollerLib.mjs), and
// the isolated Vercel function (api/share.ts). This test fails the build if any of
// them drift — the exact class of bug that caused the Czechia / Cape Verde / Côte
// d'Ivoire score-merge failures.
describe('team-alias parity across runtimes', () => {
  it('poller and share maps are identical to the canonical frontend map', () => {
    expect(POLLER_ALIASES).toEqual(TEAM_ALIASES);
    expect(SHARE_ALIASES).toEqual(TEAM_ALIASES);
  });

  it('both implementations normalise the same way', () => {
    for (const name of ['Czech Republic', 'Cape Verde Islands', 'United States', 'Curaçao', "Côte d'Ivoire", 'Brazil']) {
      expect(pollerNorm(name)).toBe(normTeam(name));
    }
  });
});
