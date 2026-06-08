import { useState, useMemo } from 'react';
import { usePreferences } from './hooks/usePreferences';
import { useTheme } from './hooks/useTheme';
import { useLiveScores } from './hooks/useLiveScores';
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

  const { darkMode, toggleDarkMode } = useTheme(prefs.teamTheme);

  // Fetch live scores from football-data.org when spoilers are enabled.
  const { scores } = useLiveScores(prefs.spoilerMode, processedMatches);

  // Merge live scores into the static fixture list
  const matches = useMemo(() => {
    if (scores.size === 0) return processedMatches;
    return processedMatches.map((m) => {
      const live = scores.get(m.id);
      if (!live) return m;
      return {
        ...m,
        score1: live.score1,
        score2: live.score2,
        status: live.status,
        minute: live.minute,
      };
    });
  }, [scores]);

  const t = useMemo(() => {
    const translations = getTranslations(prefs.language);
    return (key: keyof typeof translations) => translations[key] ?? key;
  }, [prefs.language]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Header
        prefs={prefs}
        setPrefs={setPrefs}
        page={page}
        setPage={setPage}
        t={t}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {page === 'schedule' && (
          <Schedule
            matches={matches}
            prefs={prefs}
            t={t}
            onToggleFavourite={toggleFavouriteMatch}
          />
        )}
        {page === 'groups' && (
          <Groups matches={matches} prefs={prefs} t={t} />
        )}
        {page === 'settings' && (
          <Settings
            prefs={prefs}
            setPrefs={setPrefs}
            matches={matches}
            followTeam={followTeam}
            t={t}
          />
        )}
      </main>
    </div>
  );
}
