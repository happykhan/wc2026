import { useState, useEffect } from 'react';
import type { UserPreferences } from '../types';

const STORAGE_KEY = 'wc2026_prefs';

const defaults: UserPreferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  countryCode: inferCountryFromLocale(),
  language: navigator.language || 'en',
  spoilerMode: false,
  favouriteMatches: [],
  favouriteTeams: [],
  teamTheme: null,
};

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

  return { prefs, setPrefs, toggleFavouriteMatch, followTeam };
}
