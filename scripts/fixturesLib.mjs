// Pure, dependency-free derivation of a fixtures.json row into the two things the
// rest of the app computes from it: the kickoff UTC instant and the app match id.
//
// This logic was hand-copied three times (src/data/processFixtures.ts,
// scripts/gen-match-index.mjs, scripts/vm-poller.mjs buildBase) with subtly
// different code each time — and it sits on the production data path (a wrong
// kickoff offset parks a live match on its kickoff clock). The two build-time
// .mjs scripts now import from here so there is one tested definition; the TS
// copy in processFixtures.ts is kept in lockstep by matchIndex.test.ts (which
// also asserts the parsed date, not just id+teams).

// Parse "YYYY-MM-DD" + "HH:MM UTC±N" into a UTC Date. The local kickoff time is
// expressed in a fixed UTC offset (UTC = local - offsetHours). Returns null if
// either field is missing/unparseable (knockout TBD rows have no time).
export function parseKickoffUtc(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const tm = timeStr.match(/(\d{1,2}):(\d{2})\s*UTC([+-]?\d+)?/);
  if (!tm) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  if (!y || !mo || !d) return null;
  const offsetHours = tm[3] ? parseInt(tm[3], 10) : 0;
  return new Date(Date.UTC(y, mo - 1, d, parseInt(tm[1], 10) - offsetHours, parseInt(tm[2], 10), 0));
}

// The app match-id scheme (mirrored from processFixtures.ts):
//   knockout matches with a number → m{num}      (e.g. m73)
//   group matches (no number)      → running counter m1..m72
//   the third-place + final (no number, no group) → a round slug, so they don't
//     collide with m73/m74 from the numbered knockout matches.
// Stateful counter is created per call so each consumer gets a fresh sequence in
// fixtures order — assign over rawData.matches in file order, exactly as before.
export function makeIdAssigner() {
  let counter = 1;
  return function assignId(raw) {
    if (raw.num !== undefined) return `m${raw.num}`;
    if (raw.group) return `m${counter++}`;
    return `m-${raw.round.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  };
}
