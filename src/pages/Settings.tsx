import React from 'react';
import type { UserPreferences } from '../types';
import { THEMES, getThemeForTeam } from '../data/teamColors';
import { allTeams } from '../data/processFixtures';
import type { Match } from '../types';
import type { TranslationKey } from '../data/i18n';

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

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
];

const COUNTRIES = [
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'Spain' },
  { code: 'PT', label: 'Portugal' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'BE', label: 'Belgium' },
  { code: 'AR', label: 'Argentina' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'JP', label: 'Japan' },
  { code: 'OTHER', label: 'Other' },
];

// Localised country name via the platform's Intl data (no need to hand-translate
// every country). Falls back to the English label if Intl is unavailable.
function localizedCountry(code: string, language: string, fallback: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

// Theme colour names are translated via i18n keys (Intl can't help here).
const THEME_LABEL_KEYS: Record<string, TranslationKey> = {
  'red-white': 'themeRedWhite',
  'blue-white': 'themeBlueWhite',
  'green-gold': 'themeGreenGold',
  'yellow-blue': 'themeYellowBlue',
  'orange-black': 'themeOrangeBlack',
  'tricolor': 'themeTricolour',
  'green-white': 'themeGreenWhite',
  'white-dark': 'themeWhiteDark',
};

// Localized city names for timezones where the city differs by language.
// Anything not listed falls back to the de-underscored IANA city name.
const TZ_CITY: Record<string, Partial<Record<string, string>>> = {
  'Europe/London': { es: 'Londres', fr: 'Londres' },
  'Europe/Paris': { es: 'París' },
  'Europe/Berlin': { es: 'Berlín' },
  'Europe/Lisbon': { es: 'Lisboa', fr: 'Lisbonne', de: 'Lissabon' },
  'Europe/Rome': { es: 'Roma', de: 'Rom' },
  'America/New_York': { es: 'Nueva York' },
  'America/Mexico_City': { es: 'Ciudad de México', fr: 'Mexico', de: 'Mexiko-Stadt' },
  'Asia/Tokyo': { es: 'Tokio', de: 'Tokio' },
  'Asia/Seoul': { es: 'Seúl', fr: 'Séoul' },
  'Asia/Riyadh': { es: 'Riad', fr: 'Riyad', de: 'Riad' },
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
  const handleFollowTeam = (team: string) => {
    const matchIds = matches
      .filter((m) => m.team1 === team || m.team2 === team)
      .map((m) => m.id);
    followTeam(team, matchIds);
    const theme = getThemeForTeam(team);
    setPrefs({ teamTheme: theme });
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
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code === 'OTHER' ? t('countryOther') : localizedCountry(c.code, prefs.language, c.label)}
            </option>
          ))}
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
          {COMMON_TIMEZONES.filter((tz) => tz !== prefs.timezone).map((tz) => (
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
            {allTeams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          {followedTeams.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {followedTeams.map((team) => (
                <span
                  key={team}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium"
                >
                  ★ {team}
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

      {/* Team theme — WC only */}
      {!isClubComp && (
        <Section title={t('teamTheme')}>
          <div className="grid grid-cols-3 gap-2">
            <ThemeCard
              themeKey="default"
              label={t('themeDefault')}
              active={!prefs.teamTheme || prefs.teamTheme === 'default'}
              onClick={() => setPrefs({ teamTheme: null })}
            />
            {Object.entries(THEMES).filter(([k]) => k !== 'default').map(([key, theme]) => (
              <ThemeCard
                key={key}
                themeKey={key}
                label={THEME_LABEL_KEYS[key] ? t(THEME_LABEL_KEYS[key]) : theme.name}
                active={prefs.teamTheme === key}
                onClick={() => setPrefs({ teamTheme: key })}
              />
            ))}
          </div>
        </Section>
      )}

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

function ThemeCard({ themeKey, label, active, onClick }: {
  themeKey: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const theme = THEMES[themeKey] ?? THEMES.default;
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors text-xs font-medium',
        active
          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      {/* Split swatch: left half = home kit, right half = away kit */}
      <div
        className="w-10 h-5 rounded-full overflow-hidden flex"
        title={`Home: ${theme.primary} / Away: ${theme.away ?? theme.secondary}`}
      >
        <div className="w-1/2 h-full" style={{ background: theme.primary }} />
        <div className="w-1/2 h-full" style={{ background: theme.away ?? (theme.secondary === '#ffffff' ? '#e5e7eb' : theme.secondary) }} />
      </div>
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}
