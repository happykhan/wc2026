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

  // 24-hour cache: all AFL data for WC 2026 is either static (lineups, stats
  // for finished matches) or updated infrequently.
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).json(data);
}
