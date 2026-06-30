import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getQualifiedTeams } from '../src/data/qualification.js';

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
const ESPN_SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const EMPTY_RESPONSE = { live: false, matches: [], standings: [], qualifiedTeams: getQualifiedTeams() };

interface ScoreLine {
  home: number | null;
  away: number | null;
}

interface ScoresApiMatch {
  status?: string;
  round?: string | null;
  espnEventId?: string;
  winner?: 1 | 2 | null;
  score?: {
    fullTime?: ScoreLine;
    shootout?: ScoreLine;
  };
}

function needsShootoutEnrichment(match: ScoresApiMatch): boolean {
  if (match.status !== 'FINISHED' || !match.espnEventId || !match.round) return false;
  const fullTime = match.score?.fullTime;
  if (fullTime?.home == null || fullTime?.away == null || fullTime.home !== fullTime.away) return false;
  if (match.score?.shootout?.home != null && match.score?.shootout?.away != null && match.winner) return false;
  return true;
}

async function fetchShootoutResult(eventId: string): Promise<{ shootout: ScoreLine; winner: 1 | 2 } | null> {
  try {
    const r = await fetch(`${ESPN_SUMMARY_URL}?event=${eventId}`);
    if (!r.ok) return null;
    const j = await r.json() as {
      header?: {
        competitions?: Array<{
          status?: { type?: { name?: string; detail?: string; shortDetail?: string } };
          competitors?: Array<{ homeAway?: 'home' | 'away'; shootoutScore?: number; winner?: boolean }>;
        }>;
      };
    };
    const competition = j.header?.competitions?.[0];
    const type = competition?.status?.type;
    const isPens =
      /FINAL_PEN/i.test(type?.name ?? '') ||
      /FT-Pens/i.test(type?.detail ?? '') ||
      /FT-Pens/i.test(type?.shortDetail ?? '');
    if (!isPens) return null;
    const home = competition?.competitors?.find((x) => x.homeAway === 'home');
    const away = competition?.competitors?.find((x) => x.homeAway === 'away');
    const shootout = {
      home: typeof home?.shootoutScore === 'number' ? home.shootoutScore : null,
      away: typeof away?.shootoutScore === 'number' ? away.shootoutScore : null,
    };
    if (shootout.home == null || shootout.away == null || shootout.home === shootout.away) return null;
    const winner = home?.winner === true ? 1 : 2;
    return { shootout, winner };
  } catch {
    return null;
  }
}

async function enrichPenaltyShootouts(matches: unknown[]): Promise<unknown[]> {
  return Promise.all(matches.map(async (raw) => {
    const match = raw as ScoresApiMatch;
    if (!needsShootoutEnrichment(match)) return raw;
    const shootout = await fetchShootoutResult(match.espnEventId!);
    if (!shootout) return raw;
    return {
      ...match,
      winner: shootout.winner,
      score: {
        ...(match.score ?? {}),
        fullTime: match.score?.fullTime ?? { home: null, away: null },
        shootout: shootout.shootout,
      },
    };
  }));
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch(`${VM_SCORES_URL}?t=${Math.floor(Date.now() / 12000)}`);
    if (!r.ok) {
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.status(200).json(EMPTY_RESPONSE);
    }
    const data = (await r.json()) as { live?: boolean; matches?: unknown[]; updatedAt?: string };
    const matches = await enrichPenaltyShootouts(data.matches ?? []);
    res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=12, stale-while-revalidate=20');
    return res.status(200).json({
      live: data.live ?? false,
      matches,
      standings: [],
      updatedAt: data.updatedAt,
      qualifiedTeams: getQualifiedTeams(),
    });
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(200).json(EMPTY_RESPONSE);
  }
}
