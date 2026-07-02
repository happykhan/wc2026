import { useState, useMemo, useEffect } from 'react';
import { usePreferences } from './hooks/usePreferences';
import { useTheme } from './hooks/useTheme';
import { useLiveScores } from './hooks/useLiveScores';
import { processedMatches } from './data/processFixtures';
import { resolveKnockoutMatchTeams } from './data/bracket';
import { anyMatchActive } from './utils/liveWindow';
import { getTranslations, isRtlLanguage } from './data/i18n';
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

  // Only poll at the ACTIVE cadence when a match is live or kicking off within
  // ~2h; otherwise `useLiveScores` falls back to POLL_IDLE (5 min). Re-evaluated
  // on a timer (not just at mount) so the window opens/closes as kickoff
  // approaches without needing a page reload. Computed from static kickoff times
  // (anyMatchActive), so it's independent of the live data we're deciding to fetch.
  const [pollActive, setPollActive] = useState<boolean>(() =>
    anyMatchActive(processedMatches, Date.now())
  );
  useEffect(() => {
    const tick = () => setPollActive(anyMatchActive(processedMatches, Date.now()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Fetch live scores. Fast cadence only while a match is live/imminent.
  const { scores } = useLiveScores(pollActive, processedMatches);

  // Merge live scores into the static fixture list.
  const matches = useMemo(() => {
    const scoredMatches = scores.size === 0 ? processedMatches : processedMatches.map((m) => {
      const live = scores.get(m.id);
      if (!live) return m;
      return {
        ...m,
        team1: live.team1 ?? m.team1,
        team2: live.team2 ?? m.team2,
        score1: live.score1,
        score2: live.score2,
        shootout1: live.shootout1,
        shootout2: live.shootout2,
        winner: live.winner ?? undefined,
        status: live.status,
        minute: live.minute,
        minuteAt: live.minuteAt,
        aflFixtureId: live.aflFixtureId,
        espnEventId: live.espnEventId,
      };
    });

    const resolvedKnockoutTeams = resolveKnockoutMatchTeams(scoredMatches, processedMatches);
    return scoredMatches.map((m) => {
      if (m.phase !== 'knockout') return m;
      const resolved = resolvedKnockoutTeams.get(m.id);
      if (!resolved) return m;
      if (resolved.team1 === m.team1 && resolved.team2 === m.team2 && !resolved.projected) return m;
      return { ...m, team1: resolved.team1, team2: resolved.team2, projectedKnockoutTeams: resolved.projected };
    });
  }, [scores]);

  const t = useMemo(() => {
    const translations = getTranslations(prefs.language);
    return (key: keyof typeof translations) => translations[key] ?? key;
  }, [prefs.language]);

  // Flip the document direction for right-to-left languages (Arabic).
  useEffect(() => {
    document.documentElement.dir = isRtlLanguage(prefs.language) ? 'rtl' : 'ltr';
    document.documentElement.lang = prefs.language.split('-')[0].toLowerCase();
  }, [prefs.language]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Header
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
            setPrefs={setPrefs}
            t={t}
            onToggleFavourite={toggleFavouriteMatch}
            focusMatchId={focusMatchId}
          />
        )}
        {page === 'groups' && (
          <Groups matches={matches} language={prefs.language} t={t} />
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
