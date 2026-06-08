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
  t: (k: TranslationKey) => string;
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

export function Settings({ prefs, setPrefs, matches, followTeam, t }: SettingsProps) {
  const handleFollowTeam = (team: string) => {
    const matchIds = matches
      .filter((m) => m.team1 === team || m.team2 === team)
      .map((m) => m.id);
    followTeam(team, matchIds);
    const theme = getThemeForTeam(team);
    setPrefs({ teamTheme: theme });
  };

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
            <option key={c.code} value={c.code}>{c.label}</option>
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
          <option value={prefs.timezone}>{prefs.timezone} ({t('currentTimezone')})</option>
          {COMMON_TIMEZONES.filter((tz) => tz !== prefs.timezone).map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
              ].join(' ')}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Follow a team */}
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
        {prefs.favouriteTeams.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {prefs.favouriteTeams.map((team) => (
              <span key={team} className="px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium">
                ★ {team}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Team theme */}
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
              label={theme.name}
              active={prefs.teamTheme === key}
              onClick={() => setPrefs({ teamTheme: key })}
            />
          ))}
        </div>
      </Section>

      {/* Spoiler mode */}
      <Section title={t('spoilerMode')}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPrefs({ spoilerMode: !prefs.spoilerMode })}
            className={[
              'relative w-10 h-6 rounded-full transition-colors',
              prefs.spoilerMode ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600',
            ].join(' ')}
          >
            <span className={[
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
              prefs.spoilerMode ? 'translate-x-4' : 'translate-x-0.5',
            ].join(' ')} />
          </button>
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            {prefs.spoilerMode ? t('spoilerOnDetail') : t('spoilerOffDetail')}
          </span>
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
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      <div className="flex gap-1">
        <div className="w-5 h-5 rounded-full" style={{ background: theme.primary }} />
        <div className="w-5 h-5 rounded-full" style={{ background: theme.secondary === '#ffffff' ? '#e5e7eb' : theme.secondary }} />
      </div>
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}
