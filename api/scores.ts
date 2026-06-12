import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/scores — reads the pre-computed scores JSON hosted on Nabil's VM.
//
// The poller runs on the VM (cron) and writes scores.json to disk, served at
// wc-scores.genomicx.org by its own cloudflared tunnel. This endpoint just
// proxies that (a plain GET) — NO metered service (no Vercel Blob, no KV),
// unlimited writes on the box. Makes zero live-API calls. Shape unchanged:
//   { live, matches, standings }
// ---------------------------------------------------------------------------

const VM_SCORES_URL = 'https://wc-scores.genomicx.org/scores.json';
const EMPTY_RESPONSE = { live: false, matches: [], standings: [] };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch(`${VM_SCORES_URL}?t=${Math.floor(Date.now() / 30000)}`);
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
