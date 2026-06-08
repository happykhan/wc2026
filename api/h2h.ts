import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/h2h?team={id}&limit={n} — proxy for GET /v4/teams/{id}/matches on
// football-data.org with status=FINISHED.
//
// The API key lives in process.env.FOOTBALL_DATA_KEY.  Historical match data
// is immutable so clients may cache the response indefinitely.
// ---------------------------------------------------------------------------

const FD_BASE = 'https://api.football-data.org/v4/teams';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) {
    return res.status(503).json({ error: 'API key not configured.' });
  }

  const { team, limit } = req.query;
  const teamId = Array.isArray(team) ? team[0] : team;
  const limitVal = Array.isArray(limit) ? limit[0] : (limit ?? '20');

  if (!teamId || !/^\d+$/.test(teamId)) {
    return res.status(400).json({ error: 'Invalid team ID.' });
  }

  const safeLimit = parseInt(limitVal, 10);
  if (isNaN(safeLimit) || safeLimit < 1 || safeLimit > 50) {
    return res.status(400).json({ error: 'Invalid limit.' });
  }

  const url = `${FD_BASE}/${teamId}/matches?status=FINISHED&limit=${safeLimit}`;

  const upstream = await fetch(url, {
    headers: { 'X-Auth-Token': key },
  });

  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: `Upstream returned ${upstream.status}`,
    });
  }

  const data: unknown = await upstream.json();

  // Historical match results never change — allow long-lived caching.
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).json(data);
}
