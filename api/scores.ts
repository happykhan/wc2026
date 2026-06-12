import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/scores — reads the pre-computed scores blob written by /api/poll.
//
// Fetches the blob's FIXED public URL directly (a plain GET — NOT a metered
// Blob "advanced operation"). No list() — list/put are the only ops that count
// against the free Blob quota, so this endpoint costs nothing there no matter
// how much traffic it gets. Makes zero live-API calls. Shape unchanged:
//   { live, matches, standings }
// ---------------------------------------------------------------------------

const BLOB_SCORES_URL = 'https://7sf2hc7k23vnev4a.public.blob.vercel-storage.com/scores.json';
const EMPTY_RESPONSE = { live: false, matches: [], standings: [] };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch(`${BLOB_SCORES_URL}?t=${Math.floor(Date.now() / 30000)}`);
    if (!r.ok) {
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.status(200).json(EMPTY_RESPONSE);
    }
    const data = (await r.json()) as { live?: boolean; matches?: unknown[]; updatedAt?: string };
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ live: data.live ?? false, matches: data.matches ?? [], standings: [], updatedAt: data.updatedAt });
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(200).json(EMPTY_RESPONSE);
  }
}
