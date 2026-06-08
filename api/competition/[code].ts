import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/competition/[code] — proxy for football-data.org competition matches
//
// Supports: WC (FIFA World Cup 2026), CLI (Copa Libertadores), BSA (Brasileirao)
// The API key lives in process.env.FOOTBALL_DATA_KEY (server-side only).
// Responses are cached for 5 minutes via Cache-Control headers.
// ---------------------------------------------------------------------------

const ALLOWED_CODES = new Set(['WC', 'CLI', 'BSA']);

const FD_BASE = 'https://api.football-data.org/v4/competitions';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) {
    return res.status(503).json({ error: 'API key not configured.' });
  }

  const { code } = req.query;
  const codeStr = Array.isArray(code) ? code[0] : code;

  if (!codeStr || !ALLOWED_CODES.has(codeStr.toUpperCase())) {
    return res.status(400).json({ error: `Invalid competition code. Allowed: ${[...ALLOWED_CODES].join(', ')}.` });
  }

  const url = `${FD_BASE}/${codeStr.toUpperCase()}/matches`;

  try {
    const upstream = await fetch(url, {
      headers: { 'X-Auth-Token': key },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status}`,
      });
    }

    const data = await upstream.json() as { matches?: unknown[] };

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ matches: data.matches ?? [] });
  } catch {
    return res.status(502).json({ error: 'Failed to fetch from upstream.' });
  }
}
