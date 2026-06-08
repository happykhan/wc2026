import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/scores — passthrough proxy to brain.genomicx.org/api/wc-scores
//
// The canonical source of truth is now wc_scores_poller.py running on
// openclaw, which writes ~/brain/wc-scores.json every 10 s (live) or 60 s
// (idle). brain.genomicx.org/api/wc-scores serves that file directly with
// CORS headers. This endpoint exists for backwards compatibility only; the
// client hook (useLiveScores.ts) now fetches brain.genomicx.org directly.
// ---------------------------------------------------------------------------

const UPSTREAM = 'https://brain.genomicx.org/api/wc-scores';

const EMPTY_RESPONSE = { live: false, matches: [], standings: [] };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const upstream = await fetch(UPSTREAM);
    if (!upstream.ok) {
      return res.status(upstream.status).json(EMPTY_RESPONSE);
    }
    const data: unknown = await upstream.json();
    res.setHeader('Cache-Control', 'public, max-age=10');
    return res.status(200).json(data);
  } catch {
    return res.status(200).json(EMPTY_RESPONSE);
  }
}
