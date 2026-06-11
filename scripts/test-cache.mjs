#!/usr/bin/env node
// Integration tests proving the caching + redundancy architecture works.
//
//   node scripts/test-cache.mjs [baseUrl]
//
// Asserts:
//  1. /api/scores serves from the cache (200 + matches[] + an s-maxage edge cache).
//  2. Two back-to-back /api/scores calls are identical (served from the cache,
//     not re-fetched live).
//  3. /api/poll rejects calls without the secret (401) — so user/test traffic
//     can NEVER trigger an upstream API call; only the cron can.
//  4. /api/matchdetail returns normalised lineups + stats with a `source` —
//     the redundant (ESPN → API-Football) detail endpoint works.
//  5. /api/matchdetail degrades gracefully for an unknown id (no crash).
//
// Exit code 0 = all pass, 1 = any failure.

const BASE = process.argv[2] || process.env.WC_BASE || 'https://wc2026-happykhans-projects.vercel.app';
const UA = { 'User-Agent': 'Mozilla/5.0 wc2026-cache-test' };
const OPENER_ESPN = '760415'; // Mexico v South Africa (verified)

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: UA });
  let body = null;
  try { body = await res.json(); } catch { /* non-json */ }
  return { status: res.status, cache: res.headers.get('cache-control') || '', body };
}

console.log(`\nCache/redundancy tests against ${BASE}\n`);

// 1. /api/scores is cache-backed
console.log('1) /api/scores serves from cache');
{
  const r = await get('/api/scores');
  check('200 OK', r.status === 200, `got ${r.status}`);
  check('returns matches[]', Array.isArray(r.body?.matches), `keys: ${Object.keys(r.body || {})}`);
  check('has edge cache header (s-maxage)', /s-maxage=\d+/.test(r.cache), `cache-control: ${r.cache}`);
}

// 2. consecutive reads are identical (cache, not a live re-fetch)
console.log('2) consecutive /api/scores reads are identical (cached, deterministic)');
{
  const [a, b] = await Promise.all([get('/api/scores'), get('/api/scores')]);
  check('both 200', a.status === 200 && b.status === 200);
  check('identical match count', (a.body?.matches?.length ?? -1) === (b.body?.matches?.length ?? -2));
  check('identical payload', JSON.stringify(a.body?.matches) === JSON.stringify(b.body?.matches));
}

// 3. the poller is the ONLY thing that can trigger upstream — secret-gated
console.log('3) /api/poll requires the secret (users cannot trigger upstream calls)');
{
  const r = await get('/api/poll');
  check('401 without key', r.status === 401, `got ${r.status}`);
}

// 4. redundant lineups/stats endpoint
console.log('4) /api/matchdetail returns lineups + stats with a source');
{
  const r = await get(`/api/matchdetail?espn=${OPENER_ESPN}`);
  check('200 OK', r.status === 200, `got ${r.status}`);
  check('has a source', r.body?.source === 'espn' || r.body?.source === 'afl', `source: ${r.body?.source}`);
  const teams = r.body?.teams || [];
  check('two teams', teams.length === 2, `got ${teams.length}`);
  check('has a starting XI', (teams[0]?.startXI?.length ?? 0) >= 11, `XI: ${teams[0]?.startXI?.length}`);
  check('has stats (possession)', !!teams[0]?.stats?.possession, `stats keys: ${Object.keys(teams[0]?.stats || {})}`);
  check('has an edge cache header', /s-maxage=\d+/.test(r.cache), `cache-control: ${r.cache}`);
}

// 5. graceful for an unknown id
console.log('5) /api/matchdetail degrades gracefully for an unknown id');
{
  const r = await get('/api/matchdetail?espn=999999999');
  check('200 OK (no crash)', r.status === 200, `got ${r.status}`);
  check('empty/null source', r.body?.source === null && (r.body?.teams?.length ?? 0) === 0, `source: ${r.body?.source}`);
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
