// Pure, side-effect-free helpers for the WC2026 VM poller. Separated from
// vm-poller.mjs (which does network + file writes) so they can be unit-tested in
// vitest — these encode the rules that have actually broken in production
// (full-time detection, ESPN's US-local date filing, stoppage minute parsing).
//
// The poller runs as a raw .mjs on the VM and cannot import the TypeScript
// canonical (src/data/teamMatch.ts), so TEAM_ALIASES is mirrored here. A parity
// test (src/data/aliasParity.test.ts) fails the build if the two ever drift.

export const TEAM_ALIASES = {
  czechrepublic: 'czechia',
  capeverdeislands: 'capeverde',
  congodr: 'drcongo',
  curacoa: 'curacao',
  curaao: 'curacao',
  unitedstates: 'usa',
  korearepublic: 'southkorea',
  iranislamicrepublic: 'iran',
  ivorycoast: 'cotedivoire',   // our "Ivory Coast"
  ctedivoire: 'cotedivoire',   // ESPN "Côte d'Ivoire" (accents stripped → "ctedivoire")
  trkiye: 'turkey',            // ESPN "Türkiye" (ü stripped → "trkiye")
  turkiye: 'turkey',
};

export const norm = (s) => {
  const n = (s || '').toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_ALIASES[n] ?? n;
};

export const pairKey = (a, b) => [norm(a), norm(b)].sort().join('|');

export const hasScore = (s) => !!s?.fullTime && (s.fullTime.home != null || s.fullTime.away != null);

// Right at the whistle ESPN reports state='in' + name=STATUS_FULL_TIME for a
// minute or two before flipping to state='post' — treat those as finished so the
// live clock stops on the whistle instead of ticking on.
export const espnStatus = (ev) => {
  const t = ev.status?.type;
  if (!t) return null;
  if (t.state === 'post' || t.completed || /FULL_TIME|FINAL|\bFT\b|ENDED|AFTER_/i.test(t.name || '')) return 'FINISHED';
  if (t.state === 'in') return t.name === 'STATUS_HALFTIME' ? 'PAUSED' : 'IN_PLAY';
  return null;
};

// ESPN's clock is minute-granular; displayClock looks like "65'" or "90'+3".
export const espnMinute = (ev) => {
  const m = ev.status?.displayClock?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};

// football-data.org status → our status (the fallback feed when ESPN doesn't
// resolve a match — e.g. a name ESPN spells differently). It gives final results
// even on the free tier, where this matters most for backfilling.
export const fdStatus = (s) => {
  if (s === 'FINISHED') return 'FINISHED';
  if (s === 'IN_PLAY') return 'IN_PLAY';
  if (s === 'PAUSED') return 'PAUSED';
  return null;
};

// API-Football fixture status short code → our status. Its free tier does LIVE
// (fixtures?live=all) but not historical, so it's the fallback for live matches.
export const aflStatus = (short) => {
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED';
  if (short === 'HT') return 'PAUSED';
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'IN_PLAY';
  return null;
};

// ESPN files each game under its US-LOCAL date, not UTC — a 01:00 UTC kickoff
// (US evening) is listed under the previous calendar day. Return the kickoff's
// UTC date ±1 day as YYYYMMDD strings so the fetch covers the offset either way.
export const espnDateStrings = (kickoffMs) => {
  const out = [];
  for (const off of [-1, 0, 1]) {
    const dt = new Date(kickoffMs + off * 86400000);
    out.push(`${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`);
  }
  return out;
};

// --- Live/backfill window predicates ---------------------------------------
// The poller decides, per feed tier, whether a match is worth fetching. The
// window arithmetic (live window + post-kickoff backfill window) was inlined
// three times, once per tier, each a slightly different copy on the data path
// that has caused every production incident. One tested definition here; each
// tier composes its own rule from the parts.

// Parse a match's kickoff and classify it against `now`. Returns kickoffMs=NaN
// for a match with no/invalid utcDate (caller should treat that as out-of-window).
//   liveNow:        within [kickoff, kickoff + windowMin] — actively in play
//   ended:          past the live window
//   withinBackfill: ended AND still inside the post-kickoff backfill window
export const matchWindow = (utcDate, now, windowMin, backfillMs) => {
  const kickoffMs = utcDate ? Date.parse(utcDate) : NaN;
  if (Number.isNaN(kickoffMs)) return { kickoffMs: NaN, liveNow: false, ended: false, withinBackfill: false };
  const liveEnd = kickoffMs + windowMin * 60000;
  const liveNow = now >= kickoffMs && now <= liveEnd;
  const ended = now > liveEnd;
  const withinBackfill = ended && now <= liveEnd + backfillMs;
  return { kickoffMs, liveNow, ended, withinBackfill };
};

// A status counts as "resolved" once a feed has given us live/finished state —
// i.e. no further fallback tier needs to overwrite it this poll.
export const isResolved = (status) => status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';

// Do we already have a confirmed FINAL score — from this poll's overlay (m) or a
// carried-forward prior (p)? Used to decide whether a past match still needs
// backfilling.
export const haveFinalScore = (m, p) =>
  (m.status === 'FINISHED' && hasScore(m.score)) || (!!p && p.status === 'FINISHED' && hasScore(p.score));

// Feeds may list the two teams in the opposite order to our fixture. Compare the
// home names (folded) and return {home, away} scores oriented to OUR home team.
export const orient = (ourHome, feedHome, homeVal, awayVal) =>
  norm(ourHome) !== norm(feedHome) ? { home: awayVal, away: homeVal } : { home: homeVal, away: awayVal };
