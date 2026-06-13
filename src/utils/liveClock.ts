// Pure live-match clock label, extracted from the StatusBadge so it can be tested
// in isolation (it had three production regressions: trailing the TV clock,
// jumping backwards in stoppage, and running past full time).
//
// The feed only carries whole minutes (ESPN's clock is minute-granular), so we
// extrapolate the seconds from `minuteAt` — the instant that minute was first
// observed. Key properties the tests lock in:
//   • +30s centres the unavoidable 0–60s sampling lag (else it always trails TV).
//   • The anchor holds steady while the minute plateaus (e.g. 90' through
//     stoppage), so the displayed clock counts UP smoothly — never sawtooths back.
//   • The 15-minute extrapolation cap stops a stalled poller from running away.
export const LIVE_CLOCK_CAP_MS = 15 * 60_000;
export const LIVE_CLOCK_BIAS_S = 30;

export function liveClockLabel(minute: number, minuteAt: number, now: number): string {
  const ext = Math.min(Math.max(0, now - minuteAt), LIVE_CLOCK_CAP_MS);
  const sec = Math.round(minute * 60 + ext / 1000 + LIVE_CLOCK_BIAS_S);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
