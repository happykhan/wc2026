import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/afl/[...path] — catch-all proxy for API-Football (api-sports.io)
//
// Forwards requests to https://v3.football.api-sports.io/{path}?{querystring}
// using the AFL_API_KEY server-side environment variable.
//
// Only a fixed allowlist of endpoints is permitted to prevent abuse and
// keep within the free-tier rate limit (100 req/day).
//
// Cache-Control: public, max-age=86400 is set on all responses so that
// Vercel edge caches and browsers avoid redundant upstream calls.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.AFL_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'API key not configured.' });
  }

  // path is the catch-all segment — may be a string or an array of segments.
  const rawPath = req.query.path;
  const pathSegments = Array.isArray(rawPath) ? rawPath : [rawPath ?? ''];
  const endpoint = pathSegments.join('/');

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(403).json({ error: `Endpoint not permitted: ${endpoint}` });
  }

  // Forward all query params except the internal 'path' catch-all.
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
  } catch (err) {
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
