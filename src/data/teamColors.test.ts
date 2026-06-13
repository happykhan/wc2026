import { describe, it, expect } from 'vitest';
import { THEMES, getThemeForTeam } from './teamColors';
import { allTeams } from './processFixtures';

// Guards the "pick your team" theme picker: every qualified nation must have its
// own colour entry, or it silently falls back to the default blue.
describe('team themes', () => {
  it('every fixture team has its own theme entry', () => {
    const missing = allTeams.filter((team) => !THEMES[team]);
    expect(missing).toEqual([]);
  });

  it('getThemeForTeam returns the team for a known team and default otherwise', () => {
    expect(getThemeForTeam('Brazil')).toBe('Brazil');
    expect(getThemeForTeam('Atlantis')).toBe('default');
  });

  it('every theme defines the colours the UI reads', () => {
    for (const [key, theme] of Object.entries(THEMES)) {
      expect(theme.primary, `${key}.primary`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.accent, `${key}.accent`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
