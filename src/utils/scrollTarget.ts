/**
 * Pick which date group the schedule should cue to on initial load, so the user
 * lands on today's matches instead of the top of a long list of finished ones.
 *
 * Inputs are date keys in `yyyy-MM-dd` form (lexicographically sortable) — the
 * same keys `getDateKey` produces for the day-grouped match list — plus today's
 * key in the user's timezone.
 *
 * Returns the key to scroll to:
 *  - today's key, if the tournament has matches today;
 *  - otherwise the next upcoming day (the smallest key strictly after today);
 *  - otherwise the most recent past day (the whole tournament is over);
 *  - `undefined` when there are no dates at all (empty / filtered-out list).
 *
 * `dateKeys` need not be pre-sorted; this sorts a copy.
 */
export function pickScrollTargetDateKey(
  dateKeys: readonly string[],
  todayKey: string,
): string | undefined {
  if (dateKeys.length === 0) return undefined;
  const sorted = [...dateKeys].sort();
  if (sorted.includes(todayKey)) return todayKey;
  const nextUpcoming = sorted.find((k) => k > todayKey);
  if (nextUpcoming) return nextUpcoming;
  return sorted[sorted.length - 1];
}
