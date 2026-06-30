import type { Match } from '../types';

/**
 * Partition the schedule's date groups into "past" and "today + upcoming".
 *
 * The schedule lists matches in chronological order (oldest first), so on a
 * fresh load the viewport starts on long-finished match days. We collapse the
 * past days behind a toggle (hidden by default) so today's matches land at the
 * top, while keeping full chronological order when the past section is expanded.
 *
 * Inputs are date keys in `yyyy-MM-dd` form (lexicographically sortable) — the
 * same keys `getDateKey` produces for the day-grouped match list — plus today's
 * key in the user's timezone.
 *
 * "Past" = date keys strictly before today. Today's matches and every upcoming
 * day stay visible. `dateKeys` need not be pre-sorted; this works off membership,
 * not order, so the caller keeps its own (sorted) render order.
 */
export function partitionPastDateKeys(
  dateKeys: readonly string[],
  todayKey: string,
): { past: string[]; current: string[] } {
  const past: string[] = [];
  const current: string[] = [];
  for (const k of dateKeys) {
    if (k < todayKey) past.push(k);
    else current.push(k);
  }
  return { past, current };
}

type DayGroup = readonly [string, readonly Match[]];

/**
 * Split rendered schedule day groups into:
 * - past finished group-stage matches
 * - past finished knockout matches
 * - everything else (today, upcoming, and any past date that still has a live/HT match)
 *
 * This fixes midnight-crossing live matches: a match that started "yesterday"
 * but is still live/HT after midnight must remain visible in the current
 * section instead of being hidden behind a past toggle.
 */
export function partitionScheduleGroups(
  groups: readonly DayGroup[],
  todayKey: string,
): {
  pastGroupStage: DayGroup[];
  pastKnockout: DayGroup[];
  current: DayGroup[];
} {
  const pastGroupStage: DayGroup[] = [];
  const pastKnockout: DayGroup[] = [];
  const current: DayGroup[] = [];

  for (const [dateKey, matches] of groups) {
    const fullyFinishedPast = dateKey < todayKey && matches.every((match) => match.status === 'ft');
    if (!fullyFinishedPast) {
      current.push([dateKey, matches]);
      continue;
    }

    const groupMatches = matches.filter((match) => match.phase === 'group');
    const knockoutMatches = matches.filter((match) => match.phase === 'knockout');
    if (groupMatches.length > 0) pastGroupStage.push([dateKey, groupMatches]);
    if (knockoutMatches.length > 0) pastKnockout.push([dateKey, knockoutMatches]);
  }

  return { pastGroupStage, pastKnockout, current };
}

/**
 * Decide whether the past-matches section should start expanded.
 *
 * Default is collapsed (hidden) so today's matches land at the top. We override
 * to expanded in two cases:
 *  - `deepLinkIsPast`: a shared /match link points at a match in the past block,
 *    so it must be open for that card to be reachable;
 *  - the tournament is over (no current/upcoming days but there ARE past days) —
 *    leaving it collapsed would show an empty screen, so reveal them.
 *
 * `pastCount`/`currentCount` are the number of past / today-onward day groups.
 */
export function shouldStartPastExpanded(
  pastCount: number,
  currentCount: number,
  deepLinkIsPast: boolean,
): boolean {
  if (deepLinkIsPast) return true;
  return currentCount === 0 && pastCount > 0;
}
