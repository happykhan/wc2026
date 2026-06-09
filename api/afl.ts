import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/afl/* — proxy for API-Football (api-sports.io)
//
// Vite-on-Vercel projects do NOT support Next.js-style [...catch-all] function
// routing, so instead of a `api/afl/[...path].ts` file we use a single flat
// `api/afl.ts` function plus a rewrite in vercel.json:
//
//   { "source": "/api/afl/:path*", "destination": "/api/afl?path=:path*" }
//
// The requested endpoint therefore arrives in the `path` query param
// (e.g. /api/afl/fixtures/lineups?fixture=1 → path=fixtures/lineups,
//  fixture=1). It forwards to https://v3.football.api-sports.io/{path}?{qs}
// using the AFL_API_KEY server-side environment variable.
//
// Only a fixed allowlist of endpoints is permitted to prevent abuse and keep
// within the free-tier rate limit (100 req/day).
//
// Cache-Control: public, max-age=86400 is set on all responses so that Vercel
// edge caches and browsers avoid redundant upstream calls.
// ---------------------------------------------------------------------------

const AFL_BASE = 'https://v3.football.api-sports.io';

// Endpoints permitted through this proxy (exact path match after /api/afl/).
const ALLOWED_ENDPOINTS = new Set([
  'fixtures/lineups',
  'fixtures/statistics',
  'fixtures/events',
  'fixtures/players',
  'fixtures/headtohead',
  'predictions',
  'teams',
]);

// Endpoints whose data is historical/immutable (past fixtures, head-to-head
// records). These get a 1-year immutable edge cache so each unique query is
// fetched from API-Football roughly once, then served from Vercel's CDN —
// critical for staying within the free-tier 100 req/day budget.
const IMMUTABLE_ENDPOINTS = new Set([
  'fixtures/lineups',
  'fixtures/statistics',
  'fixtures/events',
  'fixtures/players',
  'fixtures/headtohead',
]);

function cacheControlFor(endpoint: string): string {
  if (IMMUTABLE_ENDPOINTS.has(endpoint)) {
    // Browser: 1 day. Edge/CDN (s-maxage): 1 year, served stale while
    // revalidating, marked immutable. Combined with the client's permanent
    // localStorage cache this means a given team-pair / fixture is fetched
    // upstream at most once.
    return 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800, immutable';
  }
  // teams / predictions can change over time — 1 day everywhere.
  return 'public, max-age=86400';
}

// Resolve the upstream endpoint from the rewritten `path` query param, with a
// fallback to parsing req.url directly (in case the function is reached without
// the rewrite, e.g. in local dev).
function resolveEndpoint(req: VercelRequest): string {
  const raw = req.query.path;
  let endpoint = Array.isArray(raw) ? raw.join('/') : (raw ?? '');
  if (!endpoint && req.url) {
    const match = req.url.match(/^\/api\/afl\/([^?]*)/);
    if (match) endpoint = decodeURIComponent(match[1]);
  }
  return endpoint.replace(/^\/+|\/+$/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.AFL_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'API key not configured.' });
  }

  const endpoint = resolveEndpoint(req);

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(403).json({ error: `Endpoint not permitted: ${endpoint}` });
  }

  // Forward all query params except the internal 'path' catch-all marker.
  const forwardParams = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'path') continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined) forwardParams.set(k, val);
  }

  const upstreamUrl = `${AFL_BASE}/${endpoint}${forwardParams.toString() ? '?' + forwardParams.toString() : ''}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { 'x-apisports-key': key },
    });
  } catch {
    return res.status(502).json({ error: 'Failed to reach upstream API.' });
  }

  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: `Upstream returned ${upstream.status}`,
    });
  }

  const data: unknown = await upstream.json();

  res.setHeader('Cache-Control', cacheControlFor(endpoint));
  return res.status(200).json(data);
}
