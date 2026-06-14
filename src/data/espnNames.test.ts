import { describe, it, expect } from 'vitest';
import { allTeams } from './processFixtures';
import { normTeam } from './teamMatch';

// The 48 team display names EXACTLY as ESPN's scoreboard returns them (snapshot
// taken 2026-06-14 from the live feed across every tournament date). This is the
// real-world guard: live scores merge by folding ESPN's name to our fixture name
// via normTeam, so EVERY name below must resolve to one of our 48 teams. If a
// name stops matching (a new spelling, a broken alias, a normalisation change),
// this fails the build — which is exactly what was missing when "Türkiye" (≠
// "Turkey") silently dropped Australia 2-0 Türkiye.
//
// To refresh after a feed change: run `node scripts/audit-team-names.mjs`.
const ESPN_TEAM_NAMES = [
  'Algeria', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Bosnia-Herzegovina',
  'Brazil', 'Canada', 'Cape Verde', 'Colombia', 'Congo DR', 'Croatia', 'Curaçao',
  'Czechia', 'Ecuador', 'Egypt', 'England', 'France', 'Germany', 'Ghana', 'Haiti',
  'Iran', 'Iraq', 'Ivory Coast', 'Japan', 'Jordan', 'Mexico', 'Morocco',
  'Netherlands', 'New Zealand', 'Norway', 'Panama', 'Paraguay', 'Portugal', 'Qatar',
  'Saudi Arabia', 'Scotland', 'Senegal', 'South Africa', 'South Korea', 'Spain',
  'Sweden', 'Switzerland', 'Tunisia', 'Türkiye', 'United States', 'Uruguay',
  'Uzbekistan',
];

describe('ESPN team-name matching (live-score merge guard)', () => {
  const fixtureByToken = new Map(allTeams.map((t) => [normTeam(t), t]));

  it('every ESPN team name folds to one of our fixture teams', () => {
    const unmatched = ESPN_TEAM_NAMES.filter((n) => !fixtureByToken.has(normTeam(n)));
    expect(unmatched, `ESPN names that do not match a fixture team`).toEqual([]);
  });

  it('covers all 48 teams', () => {
    expect(ESPN_TEAM_NAMES).toHaveLength(48);
    expect(new Set(ESPN_TEAM_NAMES.map(normTeam)).size).toBe(48);
  });
});
