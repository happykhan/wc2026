import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/scores — live World Cup scores.
//
// football-data.org's free tier gives us the full fixture list + final results,
// but does NOT go live in-play for WC 2026 (matches stay "TIMED" during play).
// API-Football's free tier DOES serve live in-play data via its /fixtures?live
// endpoint (the season query is blocked, the live one isn't). So:
//   - base    = football-data /v4/competitions/WC/matches (schedule + results)
//   - overlay = API-Football live fixtures (status, minute, live score) merged
//               onto matching matches by team name.
// Returned shape stays what useLiveScores.ts expects:
//   { live, matches: FDMatch[], standings: [] }
// Edge cache keeps both upstreams within their free-tier limits.
// ---------------------------------------------------------------------------

const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches';
const AFL_LIVE_URL = 'https://v3.football.api-sports.io/fixtures?live=all';

const EMPTY_RESPONSE = { live: false, matches: [], standings: [] };

interface FDMatch {
  status?: string;
  minute?: number | null;
  score?: { fullTime?: { home: number | null; away: number | null } };
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
}

interface AflFixture {
  fixture: { status?: { short?: string; elapsed?: number | null } };
  league?: { name?: string };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  goals?: { home?: number | null; away?: number | null };
}

function normTeam(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

// API-Football status code → football-data-style status the client understands.
function mapAflStatus(short: string | undefined): string | null {
  if (!short) return null;
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'IN_PLAY';
  if (short === 'HT') return 'PAUSED';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED';
  return null; // not started / postponed etc. — leave the base value
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const fdKey = process.env.FOOTBALL_DATA_KEY;
  const aflKey = process.env.AFL_API_KEY;

  // 1. Base: football-data fixture list + results.
  let matches: FDMatch[] = [];
  if (fdKey) {
    try {
      const up = await fetch(FD_URL, { headers: { 'X-Auth-Token': fdKey } });
      if (up.ok) {
        const data = (await up.json()) as { matches?: FDMatch[] };
        matches = data.matches ?? [];
      }
    } catch {
      /* fall through with whatever we have */
    }
  }

  // 2. Overlay: API-Football live in-play data, matched by team name.
  let anyLive = false;
  if (aflKey) {
    try {
      const lr = await fetch(AFL_LIVE_URL, { headers: { 'x-apisports-key': aflKey } });
      if (lr.ok) {
        const ld = (await lr.json()) as { response?: AflFixture[] };
        const wc = (ld.response ?? []).filter((f) => /world cup/i.test(f.league?.name ?? ''));
        const byPair = new Map<string, AflFixture>();
        for (const f of wc) {
          const key = [normTeam(f.teams?.home?.name), normTeam(f.teams?.away?.name)].sort().join('|');
          byPair.set(key, f);
        }
        for (const m of matches) {
          const key = [normTeam(m.homeTeam?.name), normTeam(m.awayTeam?.name)].sort().join('|');
          const f = byPair.get(key);
          if (!f) continue;
          const status = mapAflStatus(f.fixture?.status?.short);
          if (!status) continue;
          // Align goals to our home/away (the two feeds occasionally list sides reversed).
          const reversed = normTeam(m.homeTeam?.name) !== normTeam(f.teams?.home?.name);
          const gh = f.goals?.home ?? null;
          const ga = f.goals?.away ?? null;
          m.status = status;
          m.minute = f.fixture?.status?.elapsed ?? m.minute ?? null;
          m.score = { fullTime: reversed ? { home: ga, away: gh } : { home: gh, away: ga } };
          if (status === 'IN_PLAY' || status === 'PAUSED') anyLive = true;
        }
      }
    } catch {
      /* live overlay is best-effort */
    }
  }

  if (matches.length === 0) {
    res.setHeader('Cache-Control', 'public, max-age=15');
    return res.status(200).json(EMPTY_RESPONSE);
  }

  // Refresh fast while something is live, slowly otherwise.
  const sMaxAge = anyLive ? 15 : 120;
  res.setHeader('Cache-Control', `public, max-age=8, s-maxage=${sMaxAge}, stale-while-revalidate=30`);
  return res.status(200).json({ live: anyLive, matches, standings: [] });
}
