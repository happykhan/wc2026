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
