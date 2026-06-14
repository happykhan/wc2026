// Decide whether the live-scores poller should run at its ACTIVE cadence.
//
// `useLiveScores(enabled)` polls every POLL_ACTIVE while `enabled` is true and
// every POLL_IDLE (5 min) while it's false. We only want the fast cadence when
// there is something to watch: a match that is live, or about to kick off. The
// rest of the time (no match for hours) the idle cadence is plenty and keeps us
// polite to the cache/VM.
//
// This is a PURE function of the static fixture kickoff times + a caller-supplied
// `now` (so it stays testable and free of render-time Date.now()). It does NOT
// look at merged live status — that would be circular (we'd need to be enabled to
// fetch the status that decides whether to be enabled). Kickoff time alone is the
// self-contained signal.

// Default lead: start fast-polling 2h before kickoff (lineups land ~30-60m out and
// we want the first whistle the moment it happens).
export const DEFAULT_LEAD_MS = 2 * 60 * 60_000;
// Default live tail: a match plus stoppage/HT runs comfortably under ~2.5h. Mirror
// the poller's LIVE_WINDOW_MIN (150) so the client stays fast for the whole match
// (and a bit after, until the FT result has surely propagated).
export const DEFAULT_LIVE_TAIL_MS = 150 * 60_000;

export interface LiveWindowOpts {
  leadMs?: number;
  liveTailMs?: number;
}

interface KickoffRef {
  utcDate: Date;
}

// True if `now` is inside [kickoff - leadMs, kickoff + liveTailMs] for any match.
export function anyMatchActive(
  matches: ReadonlyArray<KickoffRef>,
  now: number,
  opts: LiveWindowOpts = {}
): boolean {
  const leadMs = opts.leadMs ?? DEFAULT_LEAD_MS;
  const liveTailMs = opts.liveTailMs ?? DEFAULT_LIVE_TAIL_MS;
  for (const m of matches) {
    const ko = m.utcDate?.getTime();
    if (ko == null || Number.isNaN(ko)) continue;
    if (now >= ko - leadMs && now <= ko + liveTailMs) return true;
  }
  return false;
}
