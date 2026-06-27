import { useState, useMemo, useRef, useCallback } from 'react';
import type { Match, UserPreferences, FilterState } from '../types';
import { MatchRow } from '../components/MatchRow';
import { FilterBar } from '../components/FilterBar';
import { ICSExport } from '../components/ICSExport';
import { FeatureNoticeGroup } from '../components/FeatureNotice';
import { allTeams as wcTeams, allGroups as wcGroups } from '../data/processFixtures';
import type { TranslationKey } from '../data/i18n';
import { getDateKey, formatMatchDate, isMatchToday, isMatchTomorrow } from '../utils/time';
import { partitionPastDateKeys, shouldStartPastExpanded } from '../utils/pastMatches';

interface ScheduleProps {
  matches: Match[];
  prefs: UserPreferences;
  setPrefs: (p: Partial<UserPreferences>) => void;
  t: (k: TranslationKey) => string;
  onToggleFavourite: (id: string) => void;
  isClubComp?: boolean;
  /** Match id to auto-open and scroll to (from a shared /match/:id link). */
  focusMatchId?: string;
}

export function Schedule({ matches, prefs, setPrefs, t, onToggleFavourite, isClubComp = false, focusMatchId }: ScheduleProps) {
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

  // Group by date for display (chronological, oldest first).
  const byDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of filtered) {
      const key = getDateKey(m.utcDate, prefs.timezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, prefs.timezone]);

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

  // --- Collapse past matches ------------------------------------------------
  // The list is chronological (oldest first), so finished match days sit at the
  // top and you'd otherwise scroll past every one to reach today. We split the
  // visible day groups into "past" (strictly before today) and "current" (today
  // onward), hide the past block behind a toggle, and render today's matches at
  // the top. Order is never changed — when expanded, past days appear in their
  // normal chronological position (above today).
  const todayKey = getDateKey(new Date(), prefs.timezone);
  const { past: pastKeys, current: currentKeys } = useMemo(
    () => partitionPastDateKeys(byDate.map(([k]) => k), todayKey),
    [byDate, todayKey],
  );
  const pastKeySet = useMemo(() => new Set(pastKeys), [pastKeys]);

  const pastGroups = useMemo(() => byDate.filter(([k]) => pastKeySet.has(k)), [byDate, pastKeySet]);
  const currentGroups = useMemo(() => byDate.filter(([k]) => !pastKeySet.has(k)), [byDate, pastKeySet]);

  const pastMatchCount = useMemo(
    () => pastGroups.reduce((n, [, ms]) => n + ms.length, 0),
    [pastGroups],
  );

  // If a shared /match link points at a match in the (collapsed) past section,
  // auto-expand so the deep-linked card is reachable and scrollable.
  const deepLinkIsPast = useMemo(() => {
    if (!focusMatchId) return false;
    const m = filtered.find((x) => x.id === focusMatchId);
    if (!m) return false;
    return pastKeySet.has(getDateKey(m.utcDate, prefs.timezone));
  }, [focusMatchId, filtered, pastKeySet, prefs.timezone]);

  // Collapsed by default. Exceptions: (a) a deep-linked past match forces it open
  // so the card is reachable; (b) when there are NO current/upcoming days but
  // there ARE past days (tournament over), default to open so the screen isn't
  // empty. `useState` initialiser runs once; the deep-link case re-asserts below.
  const [showPast, setShowPast] = useState(
    () => shouldStartPastExpanded(pastKeys.length, currentKeys.length, deepLinkIsPast),
  );
  // Keep the past section open whenever a past match is deep-linked, even if the
  // focus arrives after the initial render (route change without remount).
  const effectiveShowPast = showPast || deepLinkIsPast;

  const navigateDay = useCallback((direction: 1 | -1) => {
    // If no date filter, find today or first future date as anchor
    let currentIdx = activeDateIndex;
    if (currentIdx === -1) {
      currentIdx = allDateKeys.findIndex((k) => k >= todayKey);
      if (currentIdx === -1) currentIdx = 0;
    }
    const nextIdx = currentIdx + direction;
    if (nextIdx >= 0 && nextIdx < allDateKeys.length) {
      setFilters((prev) => ({ ...prev, date: allDateKeys[nextIdx] }));
    }
  }, [activeDateIndex, allDateKeys, todayKey]);

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

  const renderDayGroup = useCallback(
    ([dateKey, dayMatches]: [string, Match[]]) => {
      // Use noon UTC on the date key to get a representative Date for label checks
      const d = new Date(dateKey + 'T12:00:00Z');
      const label = isMatchToday(d, prefs.timezone)
        ? t('today')
        : isMatchTomorrow(d, prefs.timezone)
        ? t('tomorrow')
        : formatMatchDate(d, prefs.timezone, prefs.language);

      return (
        <div key={dateKey} className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            <span className="inline-block w-1 h-3.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
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
    },
    [prefs, t, onToggleFavourite, isClubComp, focusMatchId],
  );

  return (
    <div className="space-y-6">
      <FeatureNoticeGroup
        dismissLabel={t('scheduleFeatureDismiss')}
        notices={[
          {
            id: 'knockout-schedule-v1',
            title: t('scheduleFeatureTitle'),
            primaryLabel: t('scheduleFeatureViewKnockout'),
            onPrimary: () => setFilters((prev) => ({ ...prev, group: 'knockout', date: '', search: '' })),
            children: t('scheduleFeatureBody'),
          },
        ]}
      />

      {/* Filters + export */}
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          teams={allTeams}
          groups={allGroups}
          language={prefs.language}
          t={t}
          showFavouritesTab={hasFavourites}
        />
        <div className="flex items-center gap-2">
          {/* 12h / 24h clock toggle — flips kickoff times on every card */}
          <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden text-xs font-semibold" role="group" aria-label="Clock format">
            <button
              type="button"
              onClick={() => setPrefs({ hour12: false })}
              aria-pressed={!prefs.hour12}
              className={`px-2.5 py-1.5 transition-colors ${!prefs.hour12 ? 'bg-[var(--accent)] text-white' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            >
              24h
            </button>
            <button
              type="button"
              onClick={() => setPrefs({ hour12: true })}
              aria-pressed={prefs.hour12}
              className={`px-2.5 py-1.5 transition-colors ${prefs.hour12 ? 'bg-[var(--accent)] text-white' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            >
              12h
            </button>
          </div>
          <ICSExport matches={matches} prefs={prefs} t={t} />
        </div>
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
          {/* Past-matches toggle + (when expanded) the past day groups, kept in
              their chronological position ABOVE today. Hidden entirely when
              there are no past days. */}
          {pastGroups.length > 0 && (
            <div className="space-y-8">
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                aria-expanded={effectiveShowPast}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${effectiveShowPast ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span>{effectiveShowPast ? t('hidePastMatches') : t('showPastMatches')}</span>
                <span className="inline-flex items-center justify-center min-w-[1.5rem] rounded-full bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  {pastMatchCount}
                </span>
              </button>
              {effectiveShowPast && <div className="space-y-8">{pastGroups.map(renderDayGroup)}</div>}
            </div>
          )}

          {/* Today + upcoming days — always visible, at the top. */}
          {currentGroups.map(renderDayGroup)}
        </div>
      )}
    </div>
  );
}
