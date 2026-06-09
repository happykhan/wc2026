import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/scores — live World Cup scores, straight from football-data.org.
//
// Previously this proxied a Cloudflare Worker fed by a poller daemon writing to
// Workers KV. That whole chain (poller → KV → Worker) is gone: this function
// calls football-data.org directly and relies on Vercel's edge cache so the
// upstream is hit at most once per cache window no matter how many visitors
// poll — keeping us inside football-data's free 10-requests/minute limit
// without any Cloudflare KV usage.
//
// The response shape matches what the client (useLiveScores.ts) expects:
//   { live: boolean, matches: FDMatch[], standings: [] }
// football-data's /v4/competitions/WC/matches objects already carry id,
// utcDate, status, score and team names, so they pass through unchanged.
// ---------------------------------------------------------------------------

const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

const EMPTY_RESPONSE = { live: false, matches: [], standings: [] };

interface FDMatch {
  status?: string;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) {
    res.setHeader('Cache-Control', 'public, max-age=10');
    return res.status(200).json(EMPTY_RESPONSE);
  }

  try {
    const upstream = await fetch(FD_URL, { headers: { 'X-Auth-Token': key } });
    if (!upstream.ok) {
      // Don't cache upstream errors for long.
      res.setHeader('Cache-Control', 'public, max-age=15');
      return res.status(200).json(EMPTY_RESPONSE);
    }

    const data = (await upstream.json()) as { matches?: FDMatch[] };
    const matches = data.matches ?? [];
    const live = matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');

    // Refresh fast while a match is live, slowly otherwise. The edge cache
    // (s-maxage) means football-data is queried at most ~3x/min during live
    // play and ~once/2min when idle, regardless of visitor count.
    const sMaxAge = live ? 20 : 120;
    res.setHeader(
      'Cache-Control',
      `public, max-age=10, s-maxage=${sMaxAge}, stale-while-revalidate=60`
    );
    return res.status(200).json({ live, matches, standings: [] });
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=15');
    return res.status(200).json(EMPTY_RESPONSE);
  }
}
