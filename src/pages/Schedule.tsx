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
  /** Match id to auto-open and scroll to (from a shared /match/:id link). */
  focusMatchId?: string;
}

export function Schedule({ matches, prefs, t, onToggleFavourite, isClubComp = false, focusMatchId }: ScheduleProps) {
  const [filters, setFilters] = useState<FilterState>({
    team: '',
    group: '',
    date: '',
    favouritesOnly: false,
    search: '',
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

  // Swipe-between-days — drag the list via a ref so we don't re-render every
  // (touch)move (re-rendering 100+ cards per move was the source of the jank).
  const listRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const swipeThreshold = 50;

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return matches.filter((m) => {
      if (filters.favouritesOnly && !prefs.favouriteMatches.includes(m.id)) return false;
      if (query) {
        const haystack = `${m.team1} ${m.team2} ${m.venue} ${m.city} ${m.group ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
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

  const resetDrag = useCallback(() => {
    const el = listRef.current;
    if (el) {
      el.style.transition = 'transform 0.18s ease-out, opacity 0.18s ease-out';
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragging.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    // Decide direction once: if it's a vertical scroll, let the page handle it.
    if (!dragging.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { touchStart.current = null; return; }
      dragging.current = true;
    }
    const el = listRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx * 0.25}px)`;
      el.style.opacity = String(1 - Math.min(Math.abs(dx) / 700, 0.25));
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStart.current;
    const wasDragging = dragging.current;
    touchStart.current = null;
    dragging.current = false;
    resetDrag();
    if (wasDragging && start) {
      const dx = e.changedTouches[0].clientX - start.x;
      if (Math.abs(dx) >= swipeThreshold) navigateDay(dx < 0 ? 1 : -1);
    }
  }, [navigateDay, resetDrag]);

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
          ref={listRef}
          className="space-y-8 touch-pan-y select-none will-change-transform"
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
                      initialExpanded={!!focusMatchId && m.id === focusMatchId}
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
