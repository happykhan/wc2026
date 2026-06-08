import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/match/[id] — proxy for GET /v4/matches/{id} on football-data.org
//
// Returns the full match object including homeTeam/awayTeam lineup, bench,
// and statistics arrays. The API key lives in process.env.FOOTBALL_DATA_KEY.
// No server-side caching: completed match data is cached permanently by the
// client in localStorage (once a match is FT the lineup never changes).
// ---------------------------------------------------------------------------

const FD_BASE = 'https://api.football-data.org/v4/matches';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) {
    return res.status(503).json({ error: 'API key not configured.' });
  }

  const { id } = req.query;
  const matchId = Array.isArray(id) ? id[0] : id;

  if (!matchId || !/^\d+$/.test(matchId)) {
    return res.status(400).json({ error: 'Invalid match ID.' });
  }

  const upstream = await fetch(`${FD_BASE}/${matchId}`, {
    headers: { 'X-Auth-Token': key },
  });

  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: `Upstream returned ${upstream.status}`,
    });
  }

  const data: unknown = await upstream.json();

  // Allow client to cache: completed match data is immutable.
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json(data);
}
