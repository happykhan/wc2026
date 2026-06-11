import type { VercelRequest, VercelResponse } from '@vercel/node';
import { list } from '@vercel/blob';

// ---------------------------------------------------------------------------
// /api/scores — reads the pre-computed scores blob written by /api/poll.
//
// This endpoint makes NO upstream API call, ever. The live APIs are only hit by
// /api/poll (cron + secret + adaptive throttle), so no amount of user or test
// traffic can spend the API-Football daily quota. Shape is unchanged for the
// client: { live, matches, standings }.
// ---------------------------------------------------------------------------

const BLOB_PATH = 'scores.json';
const EMPTY_RESPONSE = { live: false, matches: [], standings: [] };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    const blob = blobs.find((b) => b.pathname === BLOB_PATH);
    if (!blob) {
      // Poller hasn't run yet — short cache so we pick it up soon.
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.status(200).json(EMPTY_RESPONSE);
    }
    const r = await fetch(blob.url, { cache: 'no-store' });
    if (!r.ok) {
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.status(200).json(EMPTY_RESPONSE);
    }
    const data = (await r.json()) as { live?: boolean; matches?: unknown[] };
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ live: data.live ?? false, matches: data.matches ?? [], standings: [] });
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(200).json(EMPTY_RESPONSE);
  }
}
