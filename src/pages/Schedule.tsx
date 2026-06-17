import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Match, UserPreferences, FilterState } from '../types';
import { MatchRow } from '../components/MatchRow';
import { FilterBar } from '../components/FilterBar';
import { ICSExport } from '../components/ICSExport';
import { allTeams as wcTeams, allGroups as wcGroups } from '../data/processFixtures';
import type { TranslationKey } from '../data/i18n';
import { getDateKey, formatMatchDate, isMatchToday, isMatchTomorrow } from '../utils/time';
import { pickScrollTargetDateKey } from '../utils/scrollTarget';

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

  // --- Cue to today on load -------------------------------------------------
  // The list is in chronological order (oldest first), so on a fresh load the
  // viewport starts on long-finished matches. We auto-scroll to today's date
  // group (or the next upcoming day if today has none), and offer a sticky
  // "Jump to today" button to re-cue at any time. Past matches stay above —
  // we never hide or reorder them.
  const dateGroupRefs = useRef(new Map<string, HTMLDivElement>());
  const didAutoScroll = useRef(false);
  const userHasScrolled = useRef(false);

  // Which date group to cue to, recomputed as the (filtered) day list changes.
  const scrollTargetKey = useMemo(() => {
    const keys = byDate.map(([k]) => k);
    return pickScrollTargetDateKey(keys, getDateKey(new Date(), prefs.timezone));
  }, [byDate, prefs.timezone]);

  const scrollToTarget = useCallback(
    (behavior: ScrollBehavior) => {
      if (!scrollTargetKey) return false;
      const el = dateGroupRefs.current.get(scrollTargetKey);
      if (!el) return false;
      el.scrollIntoView({ behavior, block: 'start' });
      return true;
    },
    [scrollTargetKey],
  );

  // Note if the user scrolls before our auto-scroll runs, so we never yank their
  // position out from under them. This catches scrolls AFTER the listener mounts;
  // the live `window.scrollY` check below catches any earlier ones the listener
  // missed (e.g. browser scroll-restoration or a fast flick during first paint).
  useEffect(() => {
    const onScroll = () => {
      userHasScrolled.current = true;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // One-time auto-scroll once the day groups have rendered. Skipped when a
  // shared /match link is being focused (MatchRow scrolls to that card itself),
  // and skipped if the user already scrolled. `requestAnimationFrame` waits for
  // layout so scrollIntoView lands on the real position.
  useEffect(() => {
    if (didAutoScroll.current) return;
    if (focusMatchId) {
      didAutoScroll.current = true; // defer entirely to the deep-link scroll
      return;
    }
    if (userHasScrolled.current) return;
    if (byDate.length === 0) return; // data not in yet — try again on next render
    const raf = requestAnimationFrame(() => {
      // Re-check at fire time: if the listener flagged a scroll, or the page is
      // already meaningfully scrolled away from the top (an early scroll the
      // listener missed), the user is in control — don't override them.
      if (userHasScrolled.current) return;
      if (typeof window !== 'undefined' && window.scrollY > 40) {
        userHasScrolled.current = true;
        didAutoScroll.current = true;
        return;
      }
      // 'auto' (instant) on first paint avoids a long animated scroll past every
      // finished match; the manual button uses 'smooth'.
      if (scrollToTarget('auto')) didAutoScroll.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [byDate.length, focusMatchId, scrollToTarget]);

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
          {byDate.map(([dateKey, dayMatches]) => {
            // Use noon UTC on the date key to get a representative Date for label checks
            const d = new Date(dateKey + 'T12:00:00Z');
            const label = isMatchToday(d, prefs.timezone)
              ? t('today')
              : isMatchTomorrow(d, prefs.timezone)
              ? t('tomorrow')
              : formatMatchDate(d, prefs.timezone, prefs.language);

            return (
              <div
                key={dateKey}
                ref={(el) => {
                  if (el) dateGroupRefs.current.set(dateKey, el);
                  else dateGroupRefs.current.delete(dateKey);
                }}
                className="scroll-mt-20 space-y-2"
              >
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
          })}
        </div>
      )}

      {/* Sticky "Jump to today" — always available to re-cue after scrolling.
          Hidden when the list is empty / there is no target day. Uses logical
          `end-4` so it sits bottom-right in LTR and bottom-left in RTL (Arabic). */}
      {scrollTargetKey && (
        <button
          type="button"
          onClick={() => {
            userHasScrolled.current = true; // an explicit jump is not "untouched"
            scrollToTarget('smooth');
          }}
          className="fixed bottom-4 end-4 z-30 flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20 ring-1 ring-black/5 transition-transform hover:scale-105 active:scale-95"
          aria-label={t('jumpToToday')}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
          {t('jumpToToday')}
        </button>
      )}
    </div>
  );
}
