import React from 'react';
import { Eye, EyeOff, Settings, LayoutList, Sun, Moon, Monitor } from 'lucide-react';
import type { UserPreferences } from '../types';
import type { TranslationKey } from '../data/i18n';
import type { DarkModePreference } from '../hooks/useTheme';

type Page = 'schedule' | 'groups' | 'settings';

interface HeaderProps {
  prefs: UserPreferences;
  setPrefs: (p: Partial<UserPreferences>) => void;
  page: Page;
  setPage: (p: Page) => void;
  t: (k: TranslationKey) => string;
  darkMode: DarkModePreference;
  onToggleDarkMode: () => void;
}

const FLAG_MAP: Record<string, string> = {
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  France: '🇫🇷', Germany: '🇩🇪', Brazil: '🇧🇷', Argentina: '🇦🇷',
  Spain: '🇪🇸', Portugal: '🇵🇹', Netherlands: '🇳🇱', Belgium: '🇧🇪',
  USA: '🇺🇸', Mexico: '🇲🇽', Japan: '🇯🇵', Australia: '🇦🇺',
  'South Korea': '🇰🇷', Morocco: '🇲🇦', Senegal: '🇸🇳',
};

// Icon and tooltip for each dark-mode state
const DARK_MODE_META: Record<DarkModePreference, { icon: React.ReactNode; label: string }> = {
  system:  { icon: <Monitor size={16} />, label: 'Theme: following system — click for dark' },
  dark:    { icon: <Moon size={16} />,    label: 'Theme: dark — click for light' },
  light:   { icon: <Sun size={16} />,     label: 'Theme: light — click to follow system' },
};

export function Header({ prefs, setPrefs, page, setPage, t, darkMode, onToggleDarkMode }: HeaderProps) {
  const teamFlag = prefs.favouriteTeams[0] ? (FLAG_MAP[prefs.favouriteTeams[0]] ?? null) : null;
  const dmMeta = DARK_MODE_META[darkMode];

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {teamFlag && <span className="text-xl">{teamFlag}</span>}
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
            {t('appTitle')}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex gap-1 flex-1">
          <NavButton active={page === 'schedule'} onClick={() => setPage('schedule')} icon={<LayoutList size={15} />} label={t('schedule')} />
          <NavButton active={page === 'groups'} onClick={() => setPage('groups')} icon={<span className="text-xs font-bold">A-L</span>} label={t('groups')} />
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Spoiler toggle */}
          <button
            onClick={() => setPrefs({ spoilerMode: !prefs.spoilerMode })}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              prefs.spoilerMode
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
            ].join(' ')}
            title={prefs.spoilerMode ? t('spoilerToggleOn') : t('spoilerToggleOff')}
          >
            {prefs.spoilerMode ? <Eye size={13} /> : <EyeOff size={13} />}
            <span className="hidden sm:inline">
              {t('spoilerMode')}: {prefs.spoilerMode ? t('spoilerOn') : t('spoilerOff')}
            </span>
          </button>

          {/* Dark-mode toggle — cycles: system → dark → light → system */}
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-full transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label={dmMeta.label}
            title={dmMeta.label}
          >
            {dmMeta.icon}
          </button>

          {/* Settings */}
          <button
            onClick={() => setPage(page === 'settings' ? 'schedule' : 'settings')}
            className={[
              'p-1.5 rounded-full transition-colors',
              page === 'settings'
                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
            ].join(' ')}
            aria-label={t('settings')}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

function NavButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors',
        active
          ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800',
      ].join(' ')}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
