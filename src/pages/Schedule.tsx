import { useState, useMemo } from 'react';
import type { Match, UserPreferences, FilterState } from '../types';
import { MatchRow } from '../components/MatchRow';
import { FilterBar } from '../components/FilterBar';
import { ICSExport } from '../components/ICSExport';
import { allTeams, allGroups } from '../data/processFixtures';
import type { TranslationKey } from '../data/i18n';
import { getDateKey, formatMatchDate, isMatchToday, isMatchTomorrow } from '../utils/time';

interface ScheduleProps {
  matches: Match[];
  prefs: UserPreferences;
  t: (k: TranslationKey) => string;
  onToggleFavourite: (id: string) => void;
}

export function Schedule({ matches, prefs, t, onToggleFavourite }: ScheduleProps) {
  const [filters, setFilters] = useState<FilterState>({
    team: '',
    group: '',
    date: '',
    favouritesOnly: false,
  });

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (filters.favouritesOnly && !prefs.favouriteMatches.includes(m.id)) return false;
      if (filters.team && m.team1 !== filters.team && m.team2 !== filters.team) return false;
      if (filters.group) {
        if (filters.group === 'knockout') {
          if (m.phase !== 'knockout') return false;
        } else {
          if (m.group !== filters.group) return false;
        }
      }
      if (filters.date) {
        const matchDate = getDateKey(m.utcDate, prefs.timezone);
        if (matchDate !== filters.date) return false;
      }
      return true;
    });
  }, [matches, filters, prefs.favouriteMatches]);

  // Group by date for display
  const byDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of filtered) {
      const key = getDateKey(m.utcDate, prefs.timezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, prefs.timezone]);

  const todayMatches = useMemo(
    () => matches.filter((m) => isMatchToday(m.utcDate, prefs.timezone)),
    [matches, prefs.timezone]
  );

  const hasFavourites = prefs.favouriteMatches.length > 0;

  return (
    <div className="space-y-6">
      {/* Today's matches callout */}
      {todayMatches.length > 0 && !filters.date && !filters.favouritesOnly && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wide">
            {t('todayGames')}
          </h2>
          <div className="space-y-2">
            {todayMatches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                prefs={prefs}
                t={t}
                onToggleFavourite={onToggleFavourite}
                timezone={prefs.timezone}
                isToday={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filters + export */}
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          teams={allTeams}
          groups={allGroups}
          t={t}
          showFavouritesTab={hasFavourites}
        />
        <ICSExport matches={matches} prefs={prefs} t={t} />
      </div>

      {/* Match list */}
      {byDate.length === 0 ? (
        <div className="py-16 text-center text-neutral-400 dark:text-neutral-500">
          {t('noMatches')}
        </div>
      ) : (
        <div className="space-y-8">
          {byDate.map(([dateKey, dayMatches]) => {
            // Use noon UTC on the date key to get a representative Date for label checks
            const d = new Date(dateKey + 'T12:00:00Z');
            const label = isMatchToday(d, prefs.timezone)
              ? t('today')
              : isMatchTomorrow(d, prefs.timezone)
              ? t('tomorrow')
              : formatMatchDate(d, prefs.timezone);

            return (
              <div key={dateKey} className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  {label}
                </h3>
                <div className="space-y-2">
                  {dayMatches.map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      prefs={prefs}
                      t={t}
                      onToggleFavourite={onToggleFavourite}
                      timezone={prefs.timezone}
                      isToday={isMatchToday(m.utcDate, prefs.timezone)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
