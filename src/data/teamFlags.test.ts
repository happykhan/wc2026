import { describe, it, expect } from 'vitest';
import { localizedTeamName, getTeamFlag } from './teamFlags';

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
