import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list } from '@vercel/blob';

// ---------------------------------------------------------------------------
// /api/poll — the ONLY thing that ever calls the live APIs.
//
// A cron hits this every couple of minutes with ?key=POLL_SECRET. It refreshes
// the football-data fixture list (cheap, 10/min limit) every time, and spends
// an API-Football live=all call ONLY when (a) a match is currently in its live
// window and (b) enough time has passed since the last live call — where "enough
// time" is an ADAPTIVE gap derived from how many hours of football the day has
// (2 min on light days, backing off toward 10 min on heavy multi-match days, so
// the 100-req/day free budget always holds). The merged result is written to
// Vercel Blob; /api/scores just reads that blob, so a user/test request can
// never trigger an upstream call.
// ---------------------------------------------------------------------------

const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches';
const AFL_LIVE_URL = 'https://v3.football.api-sports.io/fixtures?live=all';
const BLOB_PATH = 'scores.json';
const LIVE_WINDOW_MIN = 150;      // a match counts as "live" from kickoff to +150 min
const DAILY_SCORE_BUDGET = 70;    // API-Football calls/day reserved for live scores
const MIN_GAP_MIN = 2;
const MAX_GAP_MIN = 10;

interface FDMatch {
  id: number;
  utcDate?: string;
  status?: string;
  minute?: number | null;
  score?: { fullTime?: { home: number | null; away: number | null } };
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  aflFixtureId?: number;
}

interface AflFixture {
  fixture: { id?: number; status?: { short?: string; elapsed?: number | null } };
  league?: { name?: string };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  goals?: { home?: number | null; away?: number | null };
}

interface StoredScores {
  updatedAt: string;
  lastAflFetch: string | null;
  live: boolean;
  matches: FDMatch[];
  standings: [];
}

function normTeam(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

function mapAflStatus(short: string | undefined): string | null {
  if (!short) return null;
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'IN_PLAY';
  if (short === 'HT') return 'PAUSED';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED';
  return null;
}

async function readBlob(): Promise<StoredScores | null> {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    const b = blobs.find((x) => x.pathname === BLOB_PATH);
    if (!b) return null;
    const r = await fetch(b.url, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as StoredScores;
  } catch {
    return null;
  }
}

// Minutes today during which at least one match is live (merged windows).
function liveMinutesToday(matches: FDMatch[], nowMs: number): number {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const intervals = matches
    .filter((m) => m.utcDate && m.utcDate.slice(0, 10) === today)
    .map((m) => {
      const k = Date.parse(m.utcDate as string);
      return [k, k + LIVE_WINDOW_MIN * 60000] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let curS: number | null = null;
  let curE: number | null = null;
  for (const [s, e] of intervals) {
    if (curE === null || s > curE) {
      if (curE !== null && curS !== null) total += curE - curS;
      curS = s;
      curE = e;
    } else {
      curE = Math.max(curE, e);
    }
  }
  if (curE !== null && curS !== null) total += curE - curS;
  return total / 60000;
}

function isAnyLive(matches: FDMatch[], nowMs: number): boolean {
  return matches.some((m) => {
    if (!m.utcDate) return false;
    const k = Date.parse(m.utcDate);
    return nowMs >= k && nowMs <= k + LIVE_WINDOW_MIN * 60000;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.POLL_SECRET;
  if (secret && req.query.key !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const nowMs = Date.now();
  const fdKey = process.env.FOOTBALL_DATA_KEY;
  const aflKey = process.env.AFL_API_KEY;

  // 1. football-data base — schedule + final results (cheap, not the metered API).
  let matches: FDMatch[] = [];
  if (fdKey) {
    try {
      const up = await fetch(FD_URL, { headers: { 'X-Auth-Token': fdKey } });
      if (up.ok) matches = ((await up.json()) as { matches?: FDMatch[] }).matches ?? [];
    } catch { /* keep going */ }
  }

  const prior = await readBlob();

  // 2. Decide whether to spend an API-Football call.
  const anyLive = isAnyLive(matches, nowMs);
  const liveMin = liveMinutesToday(matches, nowMs);
  const gapMin = Math.min(MAX_GAP_MIN, Math.max(MIN_GAP_MIN, liveMin / DAILY_SCORE_BUDGET));
  const lastAfl = prior?.lastAflFetch ? Date.parse(prior.lastAflFetch) : 0;
  const due = nowMs - lastAfl >= gapMin * 60000;

  let didAfl = false;
  let rateLimited = false;
  let lastAflFetch = prior?.lastAflFetch ?? null;

  if (aflKey && anyLive && due) {
    try {
      const lr = await fetch(AFL_LIVE_URL, { headers: { 'x-apisports-key': aflKey } });
      if (lr.ok) {
        const ld = (await lr.json()) as { response?: AflFixture[]; errors?: Record<string, string> | unknown[] };
        const hasError = Array.isArray(ld.errors) ? ld.errors.length > 0 : ld.errors && Object.keys(ld.errors).length > 0;
        if (hasError) {
          rateLimited = true; // quota or other error — leave lastAflFetch so we back off
        } else {
          const wc = (ld.response ?? []).filter((f) => /world cup/i.test(f.league?.name ?? ''));
          const byPair = new Map<string, AflFixture>();
          for (const f of wc) {
            byPair.set([normTeam(f.teams?.home?.name), normTeam(f.teams?.away?.name)].sort().join('|'), f);
          }
          for (const m of matches) {
            const f = byPair.get([normTeam(m.homeTeam?.name), normTeam(m.awayTeam?.name)].sort().join('|'));
            if (!f) continue;
            const status = mapAflStatus(f.fixture?.status?.short);
            if (!status) continue;
            const reversed = normTeam(m.homeTeam?.name) !== normTeam(f.teams?.home?.name);
            const gh = f.goals?.home ?? null;
            const ga = f.goals?.away ?? null;
            m.status = status;
            m.minute = f.fixture?.status?.elapsed ?? m.minute ?? null;
            m.score = { fullTime: reversed ? { home: ga, away: gh } : { home: gh, away: ga } };
            if (f.fixture?.id !== undefined) m.aflFixtureId = f.fixture.id;
          }
          didAfl = true;
          lastAflFetch = new Date(nowMs).toISOString();
        }
      }
    } catch { /* best effort */ }
  }

  // 3. If we didn't refresh the live overlay this cycle, carry the last one
  //    forward so live scores persist between API-Football fetches.
  if (!didAfl && prior) {
    const priorById = new Map(prior.matches.map((m) => [m.id, m]));
    for (const m of matches) {
      const p = priorById.get(m.id);
      if (p && p.aflFixtureId && (p.status === 'IN_PLAY' || p.status === 'PAUSED' || p.status === 'FINISHED')) {
        m.status = p.status;
        m.minute = p.minute;
        m.score = p.score;
        m.aflFixtureId = p.aflFixtureId;
      }
    }
  }

  const live = matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const data: StoredScores = {
    updatedAt: new Date(nowMs).toISOString(),
    lastAflFetch,
    live,
    matches,
    standings: [],
  };

  await put(BLOB_PATH, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 30,
    allowOverwrite: true,
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    didAfl,
    rateLimited,
    anyLive,
    gapMin: Math.round(gapMin * 10) / 10,
    liveMinutesToday: Math.round(liveMin),
    live,
    matchCount: matches.length,
    updatedAt: data.updatedAt,
  });
}
