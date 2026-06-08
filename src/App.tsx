import { useState, useMemo } from 'react';
import { usePreferences } from './hooks/usePreferences';
import { useTheme } from './hooks/useTheme';
import { processedMatches } from './data/processFixtures';
import { getTranslations } from './data/i18n';
import { Header } from './components/Header';
import { Schedule } from './pages/Schedule';
import { Groups } from './pages/Groups';
import { Settings } from './pages/Settings';

type Page = 'schedule' | 'groups' | 'settings';

export default function App() {
  const { prefs, setPrefs, toggleFavouriteMatch, followTeam } = usePreferences();
  const [page, setPage] = useState<Page>('schedule');

  useTheme(prefs.teamTheme);

  const t = useMemo(() => {
    const translations = getTranslations(prefs.language);
    return (key: keyof typeof translations) => translations[key] ?? key;
  }, [prefs.language]);

  // Apply timezone to match dates for display
  // (dates are stored as UTC; format() uses local JS timezone automatically)
  // For a proper TZ implementation we'd use date-fns-tz; for now local TZ is used

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Header prefs={prefs} setPrefs={setPrefs} page={page} setPage={setPage} t={t} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {page === 'schedule' && (
          <Schedule
            matches={processedMatches}
            prefs={prefs}
            t={t}
            onToggleFavourite={toggleFavouriteMatch}
          />
        )}
        {page === 'groups' && (
          <Groups matches={processedMatches} prefs={prefs} t={t} />
        )}
        {page === 'settings' && (
          <Settings
            prefs={prefs}
            setPrefs={setPrefs}
            matches={processedMatches}
            followTeam={followTeam}
            t={t}
          />
        )}
      </main>
    </div>
  );
}
