import { useState, useEffect } from 'react';
import type { UserPreferences } from '../types';
import type { CompetitionCode } from '../types';

const STORAGE_KEY = 'wc2026_prefs';

const defaults: UserPreferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  hour12: inferHour12FromLocale(),
  countryCode: inferCountryFromLocale(),
  language: navigator.language || 'en',
  spoilerMode: false,
  favouriteMatches: [],
  favouriteTeams: [],
  teamTheme: null,
  competition: 'WC' as CompetitionCode,
};

// Default the clock format to whatever the user's locale/OS uses (e.g. 12-hour in
// the US, 24-hour in the UK) — they can flip it with the toggle on the main page.
function inferHour12FromLocale(): boolean {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
  } catch {
    return false;
  }
}

function inferCountryFromLocale(): string {
  const locale = navigator.language || 'en-GB';
  const parts = locale.split('-');
  if (parts.length >= 2) {
    const code = parts[parts.length - 1].toUpperCase();
    if (code.length === 2) return code;
  }
  return 'GB';
}

function load(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaults;
}

export function usePreferences() {
  const [prefs, setPrefsState] = useState<UserPreferences>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const setPrefs = (update: Partial<UserPreferences>) => {
    setPrefsState((prev) => ({ ...prev, ...update }));
  };

  const toggleFavouriteMatch = (matchId: string) => {
    setPrefsState((prev) => {
      const favs = prev.favouriteMatches;
      const next = favs.includes(matchId)
        ? favs.filter((id) => id !== matchId)
        : [...favs, matchId];
      return { ...prev, favouriteMatches: next };
    });
  };

  const followTeam = (team: string, matchIds: string[]) => {
    setPrefsState((prev) => {
      const teams = prev.favouriteTeams.includes(team)
        ? prev.favouriteTeams
        : [...prev.favouriteTeams, team];
      const favs = Array.from(new Set([...prev.favouriteMatches, ...matchIds]));
      return { ...prev, favouriteTeams: teams, favouriteMatches: favs };
    });
  };

  const unfollowTeam = (team: string, matchIds: string[]) => {
    setPrefsState((prev) => {
      const teams = prev.favouriteTeams.filter((t) => t !== team);
      const matchIdSet = new Set(matchIds);
      const favs = prev.favouriteMatches.filter((id) => !matchIdSet.has(id));
      return { ...prev, favouriteTeams: teams, favouriteMatches: favs };
    });
  };

  return { prefs, setPrefs, toggleFavouriteMatch, followTeam, unfollowTeam };
}
