import type { VercelRequest, VercelResponse } from '@vercel/node';
import finalScores from './data/final-scores.json' with { type: 'json' };
import { getQualifiedTeams } from '../src/data/qualification.js';

// The tournament is complete, so the final score snapshot is bundled with the
// Vercel function. Keeping the existing /api/scores response shape means the
// frontend remains unchanged while no longer depending on the former VM
// poller, static server, Cloudflare tunnel, or any live score provider.
const RESPONSE = {
  live: false,
  matches: finalScores.matches,
  standings: [],
  ukTvSchedule: finalScores.ukTvSchedule,
  updatedAt: finalScores.updatedAt,
  qualifiedTeams: getQualifiedTeams(),
};

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json(RESPONSE);
}
