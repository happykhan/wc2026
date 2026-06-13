import React, { useState } from 'react';
import type { UserPreferences } from '../types';
import { THEMES } from '../data/teamColors';
import { getTeamFlag, localizedTeamName } from '../data/teamFlags';
import { allTeams } from '../data/processFixtures';
import type { Match } from '../types';
import { LANGUAGES, type TranslationKey } from '../data/i18n';
import { DEFAULT_TV_CHANNELS } from '../data/tvChannels';

interface SettingsProps {
  prefs: UserPreferences;
  setPrefs: (p: Partial<UserPreferences>) => void;
  matches: Match[];
  followTeam: (team: string, matchIds: string[]) => void;
  unfollowTeam: (team: string, matchIds: string[]) => void;
  t: (k: TranslationKey) => string;
  isClubComp?: boolean;
}

const COMMON_TIMEZONES = [
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Lisbon', 'Europe/Amsterdam', 'Europe/Rome',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
  'America/Buenos_Aires', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai',
  'Asia/Dubai', 'Asia/Riyadh', 'Africa/Johannesburg', 'Australia/Sydney',
  'Pacific/Auckland',
];

// Current UTC offset (minutes) for a zone, so the picker can sort west→east
// instead of by an arbitrary array order.
function tzOffsetMinutes(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
  } catch {
    return 0;
  }
}


// Every territory we have broadcaster data for is selectable.
const COUNTRY_CODES = Object.keys(DEFAULT_TV_CHANNELS);

// Localised country name via the platform's Intl data (no need to hand-translate
// every country). Falls back to the English label if Intl is unavailable.
function localizedCountry(code: string, language: string, fallback: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

// Localized city names for the timezones in COMMON_TIMEZONES. Intl has no
// "city name" API, so this is hand-maintained: list a city only for the
// languages where it differs from the English IANA city (the fallback below).
const TZ_CITY: Record<string, Partial<Record<string, string>>> = {
  'Europe/London': { es: 'Londres', fr: 'Londres', pt: 'Londres' },
  'Europe/Paris': { es: 'París' },
  'Europe/Berlin': { es: 'Berlín', pt: 'Berlim' },
  'Europe/Lisbon': { es: 'Lisboa', fr: 'Lisbonne', de: 'Lissabon', pt: 'Lisboa' },
  'Europe/Rome': { es: 'Roma', de: 'Rom', pt: 'Roma' },
  'America/New_York': { es: 'Nueva York', pt: 'Nova Iorque' },
  'America/Los_Angeles': { es: 'Los Ángeles' },
  'America/Mexico_City': { es: 'Ciudad de México', fr: 'Mexico', de: 'Mexiko-Stadt', pt: 'Cidade do México' },
  'America/Sao_Paulo': { en: 'São Paulo', es: 'São Paulo', fr: 'São Paulo', de: 'São Paulo', pt: 'São Paulo' },
  'Asia/Tokyo': { es: 'Tokio', de: 'Tokio', pt: 'Tóquio' },
  'Asia/Seoul': { es: 'Seúl', fr: 'Séoul', pt: 'Seul' },
  'Asia/Shanghai': { es: 'Shanghái', de: 'Schanghai', pt: 'Xangai' },
  'Asia/Dubai': { es: 'Dubái' },
  'Asia/Riyadh': { es: 'Riad', fr: 'Riyad', de: 'Riad', pt: 'Riade' },
  'Africa/Johannesburg': { es: 'Johannesburgo', pt: 'Joanesburgo' },
};

// Friendly, localized timezone label: "City (GMT±X)" instead of the raw IANA id.
function timezoneLabel(tz: string, language: string): string {
  const lang = language.slice(0, 2);
  const city = TZ_CITY[tz]?.[lang] ?? (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
  let offset = '';
  try {
    const parts = new Intl.DateTimeFormat(language, {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    /* unknown zone — fall back to city only */
  }
  return offset ? `${city} (${offset})` : city;
}

export function Settings({ prefs, setPrefs, matches, followTeam, unfollowTeam, t, isClubComp = false }: SettingsProps) {
  const [themeQuery, setThemeQuery] = useState('');

  const handleFollowTeam = (team: string) => {
    const matchIds = matches
      .filter((m) => m.team1 === team || m.team2 === team)
      .map((m) => m.id);
    followTeam(team, matchIds);
  };

  const handleUnfollowTeam = (team: string) => {
    const matchIds = matches
      .filter((m) => m.team1 === team || m.team2 === team)
      .map((m) => m.id);
    unfollowTeam(team, matchIds);
  };

  // Teams that are in favouriteTeams and have at least one starred match
  const followedTeams = prefs.favouriteTeams.filter((team) => {
    const teamMatchIds = matches
      .filter((m) => m.team1 === team || m.team2 === team)
      .map((m) => m.id);
    return teamMatchIds.some((id) => prefs.favouriteMatches.includes(id));
  });

  // Teams for the theme picker: only those we have colours for, starred ones first
  // (for quick access — nothing auto-applies), then alphabetical, filtered by search.
  const starred = new Set(prefs.favouriteTeams);
  const teamLabel = (tm: string) => localizedTeamName(tm, prefs.language);
  const themeTeams = allTeams
    .filter((tm) => THEMES[tm])
    .sort((a, b) => {
      const sa = starred.has(a) ? 0 : 1;
      const sb = starred.has(b) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return teamLabel(a).localeCompare(teamLabel(b));
    })
    .filter((tm) => {
      const q = themeQuery.trim().toLowerCase();
      if (!q) return true;
      // Match the localised label, the English label, and the raw key.
      return teamLabel(tm).toLowerCase().includes(q) || tm.toLowerCase().includes(q);
    });

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{t('settings')}</h2>

      {/* Country / TV */}
      <Section title={t('countryAndTv')}>
        <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
          {t('countryLabel')}
        </label>
        <select
          value={prefs.countryCode}
          onChange={(e) => setPrefs({ countryCode: e.target.value })}
          className="select-field"
        >
          {COUNTRY_CODES
            .map((code) => ({ code, name: localizedCountry(code, prefs.language, code) }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          <option value="OTHER">{t('countryOther')}</option>
        </select>
      </Section>

      {/* Timezone */}
      <Section title={t('timezone')}>
        <select
          value={prefs.timezone}
          onChange={(e) => setPrefs({ timezone: e.target.value })}
          className="select-field"
        >
          <option value={prefs.timezone}>
            {timezoneLabel(prefs.timezone, prefs.language)} · {t('currentTimezone')}
          </option>
          {COMMON_TIMEZONES
            .filter((tz) => tz !== prefs.timezone)
            .sort((a, b) => tzOffsetMinutes(a) - tzOffsetMinutes(b))
            .map((tz) => (
              <option key={tz} value={tz}>{timezoneLabel(tz, prefs.language)}</option>
            ))}
        </select>
      </Section>

      {/* Language */}
      <Section title={t('language')}>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setPrefs({ language: lang.code })}
              className={[
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                prefs.language.startsWith(lang.code)
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
              ].join(' ')}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Follow a team — WC only (club names don't map to country flags/themes) */}
      {!isClubComp && (
        <Section title={t('followTeam')}>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
            {t('followTeamDescription')}
          </p>
          <select
            value=""
            onChange={(e) => { if (e.target.value) handleFollowTeam(e.target.value); }}
            className="select-field"
          >
            <option value="">{t('selectTeam')}</option>
            {[...allTeams]
              .sort((a, b) => localizedTeamName(a, prefs.language).localeCompare(localizedTeamName(b, prefs.language)))
              .map((team) => (
                <option key={team} value={team}>{localizedTeamName(team, prefs.language)}</option>
              ))}
          </select>
          {followedTeams.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {followedTeams.map((team) => (
                <span
                  key={team}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium"
                >
                  ★ {localizedTeamName(team, prefs.language)}
                  <button
                    onClick={() => handleUnfollowTeam(team)}
                    aria-label={`${t('unfollowTeam')} ${team}`}
                    className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors text-amber-600 dark:text-amber-400 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              {t('noTeamsFollowed')}
            </p>
          )}
        </Section>
      )}

      {/* Team theme — WC only. Pick a nation to recolour the app in their kit. */}
      {!isClubComp && (
        <Section title={t('teamTheme')}>
          <input
            type="search"
            value={themeQuery}
            onChange={(e) => setThemeQuery(e.target.value)}
            placeholder={t('searchTeamsPlaceholder')}
            aria-label={t('searchTeamsPlaceholder')}
            className="select-field mb-2"
          />
          <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
            {!themeQuery.trim() && (
              <ThemeCard
                themeKey="default"
                flag="🎨"
                label={t('themeDefault')}
                active={!prefs.teamTheme || prefs.teamTheme === 'default'}
                onClick={() => setPrefs({ teamTheme: null })}
              />
            )}
            {themeTeams.map((team) => (
              <ThemeCard
                key={team}
                themeKey={team}
                flag={getTeamFlag(team)}
                label={localizedTeamName(team, prefs.language)}
                active={prefs.teamTheme === team}
                onClick={() => setPrefs({ teamTheme: team })}
              />
            ))}
            {themeTeams.length === 0 && (
              <p className="col-span-3 py-4 text-center text-sm text-neutral-400 dark:text-neutral-500">
                {t('noMatches')}
              </p>
            )}
          </div>
        </Section>
      )}

      {/* About */}
      <Section title={t('about')}>
        <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
          <p>
            An unofficial, ad-free companion for the FIFA World Cup 2026 — full schedule,
            live scores, lineups &amp; stats, and where to watch, in your timezone and language.
          </p>
          <p>
            Built by{' '}
            <a
              href="https://happykhan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--accent)] hover:underline"
            >
              Nabil-Fareed Alikhan
            </a>{' '}
            — a scientist and tinkerer who builds tools for fun.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-medium">
            <a href="https://happykhan.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">happykhan.com</a>
            <a href="https://github.com/happykhan/wc2026" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Source on GitHub</a>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Open source (MIT). Live data from ESPN&apos;s public endpoints. Not affiliated with
            or endorsed by FIFA.
          </p>
        </div>
      </Section>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

// Pure white reads as an invisible swatch on the (white) card — wash it to a
// light grey so the kit colour is still visible.
function washWhite(hex: string): string {
  const h = hex.toLowerCase();
  return h === '#ffffff' || h === '#fff' ? '#e5e7eb' : hex;
}

function ThemeCard({ themeKey, flag, label, active, onClick }: {
  themeKey: string;
  flag?: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const theme = THEMES[themeKey] ?? THEMES.default;
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors text-xs font-medium',
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      <span className="text-xl leading-none h-6 flex items-center" aria-hidden="true">{flag || '🎨'}</span>
      {/* Split swatch: left half = home kit, right half = away kit */}
      <div
        className="w-10 h-4 rounded-full overflow-hidden flex ring-1 ring-black/5 dark:ring-white/10"
        title={`Home: ${theme.primary} / Away: ${theme.away ?? theme.secondary}`}
      >
        <div className="w-1/2 h-full" style={{ background: washWhite(theme.primary) }} />
        <div className="w-1/2 h-full" style={{ background: washWhite(theme.away ?? theme.secondary) }} />
      </div>
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}
