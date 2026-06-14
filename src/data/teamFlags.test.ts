import { describe, it, expect } from 'vitest';
import { localizedTeamName, getTeamFlag } from './teamFlags';
import { allTeams } from './processFixtures';
import { LANGUAGES } from './i18n';

describe('localizedTeamName', () => {
  it('keeps the curated short name for English', () => {
    expect(localizedTeamName('USA', 'en')).toBe('USA');
    expect(localizedTeamName('DR Congo', 'en')).toBe('DR Congo');
    expect(localizedTeamName('South Korea', 'en-GB')).toBe('South Korea');
  });

  it('localises via Intl region names for other languages', () => {
    expect(localizedTeamName('USA', 'es')).toBe('Estados Unidos');
    expect(localizedTeamName('USA', 'fr')).toBe('États-Unis');
    expect(localizedTeamName('Curacoa', 'es')).toBe('Curazao');
    expect(localizedTeamName('South Korea', 'es')).toBe('Corea del Sur');
    expect(localizedTeamName('Germany', 'es')).toBe('Alemania');
  });

  it('keeps England and Scotland (GB subdivisions Intl would mislabel)', () => {
    expect(localizedTeamName('England', 'es')).toBe('England');
    expect(localizedTeamName('Scotland', 'fr')).toBe('Scotland');
  });

  it('falls back to the input for an unknown team', () => {
    expect(localizedTeamName('Atlantis', 'es')).toBe('Atlantis');
  });
});

describe('getTeamFlag', () => {
  it('returns a flag for a known team and empty for unknown', () => {
    expect(getTeamFlag('Brazil')).not.toBe('');
    expect(getTeamFlag('Atlantis')).toBe('');
  });
});

// Completeness guard (mirrors teamColors.test.ts via allTeams): a future
// fixtures.json rename/add must not silently drop a flag or a localized name
// with a green build. This is the last unguarded piece of the recurring
// country-name mapping bug class — the score/alias path is already guarded
// (espnNames.test.ts, aliasParity.test.ts), and teamColors had this guard
// but teamFlags did not.
describe('team-flag coverage', () => {
  it('every fixture team has a non-empty flag', () => {
    const missing = allTeams.filter((team) => getTeamFlag(team) === '');
    expect(
      missing,
      `teams missing a flag (no teamISOCodes entry): ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('every fixture team has a non-empty English name', () => {
    const missing = allTeams.filter(
      (team) => !localizedTeamName(team, 'en'),
    );
    expect(
      missing,
      `teams with an empty English name: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('every fixture team has a non-empty localized name in every language', () => {
    for (const { code } of LANGUAGES.filter((l) => l.code !== 'en')) {
      const missing = allTeams.filter(
        (team) => !localizedTeamName(team, code),
      );
      expect(
        missing,
        `teams with an empty name in '${code}': ${missing.join(', ')}`,
      ).toEqual([]);
    }
  });
});
