import { useState, useEffect } from 'react';
import type { UserPreferences } from '../types';
import type { CompetitionCode } from '../types';
import { LANGUAGES } from '../data/i18n';

const STORAGE_KEY = 'wc2026_prefs';

const defaults: UserPreferences = {
  timezone: inferTimezone(),
  hour12: inferHour12FromLocale(),
  countryCode: inferCountryFromLocale(),
  language: inferLanguage(),
  spoilerMode: false,
  favouriteMatches: [],
  favouriteTeams: [],
  teamTheme: null,
  competition: 'WC' as CompetitionCode,
};

// The browser auto-detection helpers. Parameterised (with sensible runtime
// defaults) so they can be unit-tested deterministically per locale.

/** The browser/OS IANA timezone, e.g. "Europe/London". */
export function inferTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Default the clock format to whatever the locale/OS uses (12-hour in the US,
// 24-hour in the UK) — they can flip it with the toggle on the main page.
export function inferHour12FromLocale(locale?: string): boolean {
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
  } catch {
    return false;
  }
}

/** ISO 3166-1 alpha-2 region from a BCP-47 locale tag (defaults to GB). */
export function inferCountryFromLocale(locale: string = navigator.language || 'en-GB'): string {
  const parts = locale.split('-');
  if (parts.length >= 2) {
    const code = parts[parts.length - 1].toUpperCase();
    if (code.length === 2) return code;
  }
  return 'GB';
}

// Walk the browser's ordered language preferences and pick the first whose base
// (e.g. "pt" of "pt-BR") is a supported language; fall back to English. Pure, so
// it's unit-tested directly.
export function pickPreferredLanguage(browserLangs: readonly string[], supported: ReadonlySet<string>): string {
  for (const lang of browserLangs) {
    if (lang && supported.has(lang.split('-')[0].toLowerCase())) return lang;
  }
  return 'en';
}

function inferLanguage(): string {
  const supported = new Set(LANGUAGES.map((l) => l.code));
  const list =
    typeof navigator === 'undefined'
      ? []
      : navigator.languages?.length
        ? [...navigator.languages]
        : navigator.language
          ? [navigator.language]
          : [];
  return pickPreferredLanguage(list, supported);
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
