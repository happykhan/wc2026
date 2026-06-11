import { useState, useMemo } from 'react';
import { usePreferences } from './hooks/usePreferences';
import { useTheme } from './hooks/useTheme';
import { useLiveScores } from './hooks/useLiveScores';
import { processedMatches } from './data/processFixtures';
import { getTranslations } from './data/i18n';
import { Header } from './components/Header';
import { Schedule } from './pages/Schedule';
import { Groups } from './pages/Groups';
import { Bracket } from './pages/Bracket';
import { Settings } from './pages/Settings';

type Page = 'schedule' | 'groups' | 'bracket' | 'settings';

export default function App() {
  const { prefs, setPrefs, toggleFavouriteMatch, followTeam, unfollowTeam } = usePreferences();
  const [page, setPage] = useState<Page>('schedule');

  // Deep-link target from a shared /match/:id link (redirected to /?match=<id>).
  const focusMatchId = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return new URLSearchParams(window.location.search).get('match') ?? undefined;
  }, []);

  const { darkMode, toggleDarkMode } = useTheme(prefs.teamTheme);

  // Fetch live scores (always on — scores/results are shown by default).
  const { scores } = useLiveScores(true, processedMatches);

  // Merge live scores into the static fixture list.
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
        fdMatchId: live.fdMatchId,
        aflFixtureId: live.aflFixtureId,
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
            focusMatchId={focusMatchId}
          />
        )}
        {page === 'groups' && (
          <Groups matches={matches} t={t} />
        )}
        {page === 'bracket' && (
          <Bracket matches={matches} prefs={prefs} t={t} />
        )}
        {page === 'settings' && (
          <Settings
            prefs={prefs}
            setPrefs={setPrefs}
            matches={matches}
            followTeam={followTeam}
            unfollowTeam={unfollowTeam}
            t={t}
          />
        )}
      </main>
    </div>
  );
}
