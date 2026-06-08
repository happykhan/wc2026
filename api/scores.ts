import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/scores — server-side proxy for football-data.org match data
//
// The API key lives in process.env.FOOTBALL_DATA_KEY (set in Vercel project
// settings — server-side only, never exposed to the client bundle).
// Responses are cached in-memory for 60 seconds so simultaneous client
// requests only trigger one upstream call per minute.
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

// Module-level cache shared across warm Lambda invocations.
let cache: CacheEntry | null = null;

const CACHE_TTL_MS = 60_000;
const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) {
    return res.status(503).json({ error: 'API key not configured.' });
  }

  const now = Date.now();

  // Return cached data if still fresh.
  if (cache && cache.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  const upstream = await fetch(FD_URL, {
    headers: { 'X-Auth-Token': key },
  });

  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: `Upstream returned ${upstream.status}`,
    });
  }

  const data: unknown = await upstream.json();

  cache = { data, expiresAt: now + CACHE_TTL_MS };

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('X-Cache', 'MISS');
  return res.status(200).json(data);
}
