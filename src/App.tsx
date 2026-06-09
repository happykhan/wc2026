import { useState, useMemo } from 'react';
import { usePreferences } from './hooks/usePreferences';
import { useTheme } from './hooks/useTheme';
import { useLiveScores } from './hooks/useLiveScores';
import { useCompetitionMatches } from './hooks/useCompetitionMatches';
import { processedMatches } from './data/processFixtures';
import { getTranslations } from './data/i18n';
import { Header } from './components/Header';
import { Schedule } from './pages/Schedule';
import { Groups } from './pages/Groups';
import { Bracket } from './pages/Bracket';
import { Settings } from './pages/Settings';
import { COMPETITIONS } from './types';

type Page = 'schedule' | 'groups' | 'bracket' | 'settings';

export default function App() {
  const { prefs, setPrefs, toggleFavouriteMatch, followTeam, unfollowTeam } = usePreferences();
  const [page, setPage] = useState<Page>('schedule');

  const { darkMode, toggleDarkMode } = useTheme(prefs.teamTheme);

  const competition = prefs.competition ?? 'WC';
  const competitionMeta = COMPETITIONS.find((c) => c.code === competition) ?? COMPETITIONS[0];
  const isClubComp = !competitionMeta.isNational;

  // Fetch club competition matches from the API when not on WC.
  const { matches: clubMatches, state: clubState } = useCompetitionMatches(competition, prefs.spoilerMode);

  // Fetch live scores from the WC Cloudflare Worker — only for WC.
  const { scores } = useLiveScores(!isClubComp && prefs.spoilerMode, processedMatches);

  // Merge live scores into the WC static fixture list.
  const wcMatches = useMemo(() => {
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
      };
    });
  }, [scores]);

  // Choose the correct match list based on the selected competition.
  const matches = isClubComp ? clubMatches : wcMatches;

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
        competitionMeta={competitionMeta}
        isClubComp={isClubComp}
      />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Loading state for club competitions */}
        {isClubComp && clubState === 'loading' && (
          <div className="flex items-center justify-center py-16 gap-3 text-neutral-400">
            <span className="inline-block w-5 h-5 rounded-full border-2 border-neutral-300 border-t-[var(--accent)] animate-spin" />
            <span className="text-sm">Loading {competitionMeta.name} fixtures&hellip;</span>
          </div>
        )}
        {isClubComp && clubState === 'error' && (
          <div className="py-16 text-center text-neutral-400 text-sm">
            Could not load {competitionMeta.name} fixtures. Please try again.
          </div>
        )}
        {(!isClubComp || clubState === 'loaded') && (
          <>
            {(page === 'schedule' || (page === 'bracket' && isClubComp)) && (
              <Schedule
                matches={matches}
                prefs={prefs}
                t={t}
                onToggleFavourite={toggleFavouriteMatch}
                isClubComp={isClubComp}
              />
            )}
            {page === 'groups' && (
              <Groups
                matches={matches}
                prefs={prefs}
                t={t}
                onToggleSpoilers={() => setPrefs({ spoilerMode: true })}
              />
            )}
            {page === 'bracket' && !isClubComp && (
              <Bracket
                matches={matches}
                prefs={prefs}
                t={t}
                onToggleSpoilers={() => setPrefs({ spoilerMode: true })}
              />
            )}
            {page === 'settings' && (
              <Settings
                prefs={prefs}
                setPrefs={setPrefs}
                matches={matches}
                followTeam={followTeam}
                unfollowTeam={unfollowTeam}
                t={t}
                isClubComp={isClubComp}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
