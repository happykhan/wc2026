import { describe, it, expect } from 'vitest';
import fixturesData from './fixtures.json';
import { normTeam } from './teamMatch';
import { getUkChannelsForMatch } from './ukTvSchedule';

interface Fx { team1: string; team2: string; group?: string }
const groupMatches = (fixturesData as { matches: Fx[] }).matches.filter((m) => m.group);

// Snapshot of the 48 team names as the live feed (football-data / ESPN) spells
// them, captured 2026-06-12. If a feed renames a team this test fails — update
// the snapshot AND add the alias in teamMatch.ts. This is the guard that stops
// the "Czechia / Cape Verde Islands / Congo DR / Curaçao" score-merge bugs.
const FEED_TEAM_NAMES = [
  'Algeria', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Bosnia-Herzegovina', 'Brazil', 'Canada',
  'Cape Verde Islands', 'Colombia', 'Congo DR', 'Croatia', 'Curaçao', 'Czechia', 'Ecuador', 'Egypt', 'England',
  'France', 'Germany', 'Ghana', 'Haiti', 'Iran', 'Iraq', 'Ivory Coast', 'Japan', 'Jordan', 'Mexico', 'Morocco',
  'Netherlands', 'New Zealand', 'Norway', 'Panama', 'Paraguay', 'Portugal', 'Qatar', 'Saudi Arabia', 'Scotland',
  'Senegal', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Tunisia', 'Turkey', 'United States',
  'Uruguay', 'Uzbekistan',
];

describe('team-name matching against the live feed', () => {
  const feedSet = new Set(FEED_TEAM_NAMES.map(normTeam));
  const internalTeams = [...new Set(groupMatches.flatMap((m) => [m.team1, m.team2]))];

  it('every internal team name matches a feed name (so live scores merge)', () => {
    const unmatched = internalTeams.filter((t) => !feedSet.has(normTeam(t)));
    expect(unmatched, `fixture teams that won't merge a live score: ${unmatched.join(', ')}`).toEqual([]);
  });

  it('the feed snapshot still has all 48 teams', () => {
    expect(FEED_TEAM_NAMES.length).toBe(48);
  });
});

describe('UK TV schedule', () => {
  it('every group match has a UK channel (no generic BBC/ITV fallback)', () => {
    const missing = groupMatches
      .filter((m) => !getUkChannelsForMatch(m.team1, m.team2))
      .map((m) => `${m.team1} v ${m.team2}`);
    expect(missing, `missing UK channel: ${missing.join('; ')}`).toEqual([]);
  });

  it('the primary channel is specific (BBC One/Two, ITV1/ITV4), never generic', () => {
    const ALLOWED = ['BBC One', 'BBC Two', 'ITV1', 'ITV4'];
    const bad = groupMatches
      .map((m) => ({ label: `${m.team1} v ${m.team2}`, ch: getUkChannelsForMatch(m.team1, m.team2) }))
      .filter(({ ch }) => ch && !ALLOWED.includes(ch[0]))
      .map(({ label, ch }) => `${label} → ${ch?.[0]}`);
    expect(bad, `non-specific primary channel: ${bad.join('; ')}`).toEqual([]);
  });
});
