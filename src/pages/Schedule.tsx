import { useState, useMemo, useRef, useCallback } from 'react';
import type { Match, UserPreferences, FilterState } from '../types';
import { MatchRow } from '../components/MatchRow';
import { FilterBar } from '../components/FilterBar';
import { ICSExport } from '../components/ICSExport';
import { allTeams as wcTeams, allGroups as wcGroups } from '../data/processFixtures';
import type { TranslationKey } from '../data/i18n';
import { getDateKey, formatMatchDate, isMatchToday, isMatchTomorrow } from '../utils/time';

interface ScheduleProps {
  matches: Match[];
  prefs: UserPreferences;
  t: (k: TranslationKey) => string;
  onToggleFavourite: (id: string) => void;
  isClubComp?: boolean;
}

export function Schedule({ matches, prefs, t, onToggleFavourite, isClubComp = false }: ScheduleProps) {
  const [filters, setFilters] = useState<FilterState>({
    team: '',
    group: '',
    date: '',
    favouritesOnly: false,
  });

  // For club competitions derive filter options from the live match list;
  // for WC use the pre-built static arrays.
  const allTeams = useMemo(() => {
    if (!isClubComp) return wcTeams;
    return Array.from(
      new Set(matches.filter((m) => m.phase === 'group').flatMap((m) => [m.team1, m.team2]))
    ).sort();
  }, [isClubComp, matches]);

  const allGroups = useMemo(() => {
    if (!isClubComp) return wcGroups;
    return Array.from(new Set(matches.filter((m) => m.group).map((m) => m.group!))).sort();
  }, [isClubComp, matches]);

  // Swipe-between-days state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const swipeThreshold = 50;

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

  // All unique date keys in sorted order (for swipe navigation)
  const allDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const m of matches) {
      keys.add(getDateKey(m.utcDate, prefs.timezone));
    }
    return Array.from(keys).sort();
  }, [matches, prefs.timezone]);

  const activeDateIndex = useMemo(() => {
    if (!filters.date) return -1;
    return allDateKeys.indexOf(filters.date);
  }, [allDateKeys, filters.date]);

  const navigateDay = useCallback((direction: 1 | -1) => {
    // If no date filter, find today or first future date as anchor
    let currentIdx = activeDateIndex;
    if (currentIdx === -1) {
      const todayKey = getDateKey(new Date(), prefs.timezone);
      currentIdx = allDateKeys.findIndex((k) => k >= todayKey);
      if (currentIdx === -1) currentIdx = 0;
    }
    const nextIdx = currentIdx + direction;
    if (nextIdx >= 0 && nextIdx < allDateKeys.length) {
      setFilters((prev) => ({ ...prev, date: allDateKeys[nextIdx] }));
    }
  }, [activeDateIndex, allDateKeys, prefs.timezone]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    setSwipeOffset(e.touches[0].clientX - touchStartX.current);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null) return;
    const delta = swipeOffset;
    touchStartX.current = null;

    if (Math.abs(delta) >= swipeThreshold) {
      setIsAnimating(true);
      navigateDay(delta < 0 ? 1 : -1);
      setTimeout(() => {
        setSwipeOffset(0);
        setIsAnimating(false);
      }, 200);
    } else {
      setSwipeOffset(0);
    }
  }, [swipeOffset, navigateDay]);

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
                isClubComp={isClubComp}
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

      {/* Match list — swipeable on mobile */}
      {byDate.length === 0 ? (
        <div className="py-16 text-center text-neutral-400 dark:text-neutral-500">
          {t('noMatches')}
        </div>
      ) : (
        <div
          className="space-y-8 touch-pan-y select-none"
          style={{
            transform: swipeOffset !== 0 ? `translateX(${swipeOffset * 0.3}px)` : undefined,
            transition: isAnimating ? 'transform 0.2s ease-out' : undefined,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {byDate.map(([dateKey, dayMatches]) => {
            // Use noon UTC on the date key to get a representative Date for label checks
            const d = new Date(dateKey + 'T12:00:00Z');
            const label = isMatchToday(d, prefs.timezone)
              ? t('today')
              : isMatchTomorrow(d, prefs.timezone)
              ? t('tomorrow')
              : formatMatchDate(d, prefs.timezone, prefs.language);

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
                      isClubComp={isClubComp}
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
