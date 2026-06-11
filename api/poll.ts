import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list } from '@vercel/blob';

// ---------------------------------------------------------------------------
// /api/poll — the ONLY thing that ever calls the live data sources. A cron hits
// it every couple of minutes (?key=POLL_SECRET); it merges several free sources
// with fallback priority and writes the result to Vercel Blob. /api/scores just
// reads that blob, so no user/test traffic can ever spend an API budget.
//
// Source priority for live score/status:
//   1. ESPN public API   — free, no key, no daily cap. Primary. Gives accurate
//      status (incl. FULL_TIME), score, clock, and the event id used for
//      lineups/stats.
//   2. football-data.org — base fixture list (always) + a laggy/flaky live
//      fallback. 10 req/min, effectively the schedule source of truth.
//   3. API-Football      — 100 req/DAY. Pure fallback now: only touched if ESPN
//      returned nothing at all and a match is live (adaptive throttle).
// A score once seen is never erased by a later blank fetch.
// ---------------------------------------------------------------------------

const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches';
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const AFL_LIVE_URL = 'https://v3.football.api-sports.io/fixtures?live=all';
const BLOB_PATH = 'scores.json';
const LIVE_WINDOW_MIN = 150;
const DAILY_SCORE_BUDGET = 70;
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
  espnEventId?: string;
}

interface AflFixture {
  fixture: { id?: number; status?: { short?: string; elapsed?: number | null } };
  league?: { name?: string };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  goals?: { home?: number | null; away?: number | null };
}

interface EspnEvent {
  id: string;
  status?: { type?: { state?: string; name?: string; completed?: boolean }; displayClock?: string };
  competitions?: Array<{
    competitors?: Array<{ homeAway?: string; score?: string; team?: { displayName?: string } }>;
  }>;
}

interface StoredScores {
  updatedAt: string;
  lastAflFetch: string | null;
  live: boolean;
  matches: FDMatch[];
  standings: [];
}

// National-team naming differs across sources — map variants to one token.
const TEAM_ALIASES: Record<string, string> = {
  czechrepublic: 'czechia',
  unitedstates: 'usa',
  usmnt: 'usa',
  korearepublic: 'southkorea',
  republicofkorea: 'southkorea',
  iranislamicrepublic: 'iran',
  irimiran: 'iran',
  ivorycoast: 'cotedivoire',
  capeverde: 'caboverde',
};
function normTeam(s: string | undefined): string {
  const n = (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_ALIASES[n] ?? n;
}
function pairKey(a: string | undefined, b: string | undefined): string {
  return [normTeam(a), normTeam(b)].sort().join('|');
}

function mapAflStatus(short: string | undefined): string | null {
  if (!short) return null;
  if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'IN_PLAY';
  if (short === 'HT') return 'PAUSED';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED';
  return null;
}

function espnStatus(ev: EspnEvent): string | null {
  const t = ev.status?.type;
  if (!t) return null;
  if (t.state === 'post' || t.completed) return 'FINISHED';
  if (t.state === 'in') return t.name === 'STATUS_HALFTIME' ? 'PAUSED' : 'IN_PLAY';
  return null; // pre / scheduled — leave the football-data base
}
function espnMinute(ev: EspnEvent): number | null {
  const m = ev.status?.displayClock?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// ESPN bans on burst, not on a daily count — so only call it for the date(s)
// of matches that are actually live or just finished, never on a fixed clock.
async function fetchEspnDates(dates: string[]): Promise<EspnEvent[]> {
  const out: EspnEvent[] = [];
  for (const d of dates) {
    try {
      const r = await fetch(`${ESPN_SCOREBOARD}?dates=${d}`);
      if (r.ok) out.push(...(((await r.json()) as { events?: EspnEvent[] }).events ?? []));
    } catch { /* skip this date */ }
  }
  return out;
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

function liveMinutesToday(matches: FDMatch[], nowMs: number): number {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const intervals = matches
    .filter((m) => m.utcDate && m.utcDate.slice(0, 10) === today)
    .map((m) => {
      const k = Date.parse(m.utcDate as string);
      return [k, k + LIVE_WINDOW_MIN * 60000] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
  let total = 0, curS: number | null = null, curE: number | null = null;
  for (const [s, e] of intervals) {
    if (curE === null || s > curE) {
      if (curE !== null && curS !== null) total += curE - curS;
      curS = s; curE = e;
    } else curE = Math.max(curE, e);
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
const hasScore = (s?: { fullTime?: { home: number | null; away: number | null } }) =>
  !!s?.fullTime && (s.fullTime.home !== null || s.fullTime.away !== null);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.POLL_SECRET;
  if (secret && req.query.key !== secret) return res.status(401).json({ error: 'unauthorized' });

  const nowMs = Date.now();
  const fdKey = process.env.FOOTBALL_DATA_KEY;
  const aflKey = process.env.AFL_API_KEY;

  // 1. football-data base — schedule + ids + team names (cheap, not metered hard).
  let matches: FDMatch[] = [];
  if (fdKey) {
    try {
      const up = await fetch(FD_URL, { headers: { 'X-Auth-Token': fdKey } });
      if (up.ok) matches = ((await up.json()) as { matches?: FDMatch[] }).matches ?? [];
    } catch { /* keep going */ }
  }

  const prior = await readBlob();
  const priorById = new Map((prior?.matches ?? []).map((m) => [m.id, m]));

  // Which dates need an ESPN check? Only matches live now, or just finished and
  // we don't yet have a final score for them. Otherwise ESPN is not called.
  const needDates = new Set<string>();
  for (const m of matches) {
    if (!m.utcDate) continue;
    const k = Date.parse(m.utcDate);
    const liveNow = nowMs >= k && nowMs <= k + LIVE_WINDOW_MIN * 60000;
    const p = priorById.get(m.id);
    const haveFinal = (m.status === 'FINISHED' && hasScore(m.score)) || (!!p && p.status === 'FINISHED' && hasScore(p.score));
    const haveEspnId = !!m.espnEventId || !!p?.espnEventId;
    // After the window, one last check to capture the final score + the ESPN
    // event id (needed for lineups/stats) — then we stop touching ESPN.
    const justEnded = nowMs > k + LIVE_WINDOW_MIN * 60000 && nowMs <= k + (LIVE_WINDOW_MIN + 60) * 60000 && (!haveFinal || !haveEspnId);
    if (liveNow || justEnded) needDates.add(m.utcDate.slice(0, 10).replace(/-/g, ''));
  }

  // 2. PRIMARY live overlay: ESPN (free, uncapped) — only when needed.
  let usedEspn = false;
  let espnCount = 0;
  let espnMatched = 0;
  const espnSample: string[] = [];
  if (needDates.size > 0) {
    try {
      const events = await fetchEspnDates([...needDates]);
      espnCount = events.length;
      const byPair = new Map<string, { ev: EspnEvent; hName?: string; hScore: number; aScore: number }>();
      for (const ev of events) {
        const comp = ev.competitions?.[0];
        const h = comp?.competitors?.find((c) => c.homeAway === 'home');
        const a = comp?.competitors?.find((c) => c.homeAway === 'away');
        if (!h?.team?.displayName || !a?.team?.displayName) continue;
        if (espnSample.length < 4) espnSample.push(`${h.team.displayName} ${h.score}-${a.score} ${a.team.displayName} [${ev.status?.type?.name}]`);
        byPair.set(pairKey(h.team.displayName, a.team.displayName), {
          ev, hName: h.team.displayName,
          hScore: parseInt(h.score ?? '', 10), aScore: parseInt(a.score ?? '', 10),
        });
      }
      for (const m of matches) {
        const hit = byPair.get(pairKey(m.homeTeam?.name, m.awayTeam?.name));
        if (!hit) continue;
        const status = espnStatus(hit.ev);
        if (!status) continue;
        const reversed = normTeam(m.homeTeam?.name) !== normTeam(hit.hName);
        const hs = Number.isNaN(hit.hScore) ? null : hit.hScore;
        const as = Number.isNaN(hit.aScore) ? null : hit.aScore;
        m.status = status;
        m.minute = espnMinute(hit.ev);
        m.score = { fullTime: reversed ? { home: as, away: hs } : { home: hs, away: as } };
        m.espnEventId = hit.ev.id;
        usedEspn = true;
        espnMatched++;
      }
    } catch { /* ESPN best-effort; fall through to fallbacks */ }
  }

  // 3. FALLBACK: API-Football, only if ESPN gave us nothing and a match is live.
  const anyLive = isAnyLive(matches, nowMs);
  const liveMin = liveMinutesToday(matches, nowMs);
  const gapMin = Math.min(MAX_GAP_MIN, Math.max(MIN_GAP_MIN, liveMin / DAILY_SCORE_BUDGET));
  const lastAfl = prior?.lastAflFetch ? Date.parse(prior.lastAflFetch) : 0;
  const due = nowMs - lastAfl >= gapMin * 60000;
  let didAfl = false;
  let rateLimited = false;
  let lastAflFetch = prior?.lastAflFetch ?? null;

  if (!usedEspn && aflKey && anyLive && due) {
    try {
      const lr = await fetch(AFL_LIVE_URL, { headers: { 'x-apisports-key': aflKey } });
      if (lr.ok) {
        const ld = (await lr.json()) as { response?: AflFixture[]; errors?: Record<string, string> | unknown[] };
        const hasError = Array.isArray(ld.errors) ? ld.errors.length > 0 : ld.errors && Object.keys(ld.errors).length > 0;
        if (hasError) {
          rateLimited = true;
        } else {
          const byPair = new Map<string, AflFixture>();
          for (const f of (ld.response ?? []).filter((f) => /world cup/i.test(f.league?.name ?? ''))) {
            byPair.set(pairKey(f.teams?.home?.name, f.teams?.away?.name), f);
          }
          for (const m of matches) {
            const f = byPair.get(pairKey(m.homeTeam?.name, m.awayTeam?.name));
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

  // 4. Never let a blank fetch erase a score we already had. Carry prior forward.
  if (prior) {
    for (const m of matches) {
      const p = priorById.get(m.id);
      if (!p) continue;
      const priorResult = p.status === 'IN_PLAY' || p.status === 'PAUSED' || p.status === 'FINISHED' || hasScore(p.score);
      const currentBlank = !m.status || m.status === 'TIMED' || m.status === 'SCHEDULED' || !hasScore(m.score);
      if (priorResult && currentBlank) {
        m.status = p.status;
        m.minute = p.minute;
        m.score = p.score;
        if (p.aflFixtureId) m.aflFixtureId = p.aflFixtureId;
        if (p.espnEventId) m.espnEventId = p.espnEventId;
        if ((m.status === 'IN_PLAY' || m.status === 'PAUSED') && m.utcDate &&
            nowMs > Date.parse(m.utcDate) + LIVE_WINDOW_MIN * 60000) {
          m.status = 'FINISHED';
        }
      } else {
        if (p.aflFixtureId && !m.aflFixtureId) m.aflFixtureId = p.aflFixtureId;
        if (p.espnEventId && !m.espnEventId) m.espnEventId = p.espnEventId;
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

  const opener = matches.find((m) => /mexico/i.test(m.homeTeam?.name ?? ''));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true, usedEspn, espnDates: [...needDates], espnCount, espnMatched, espnSample,
    didAfl, rateLimited, anyLive, gapMin: Math.round(gapMin * 10) / 10, live,
    matchCount: matches.length, updatedAt: data.updatedAt,
    openerSample: opener ? { status: opener.status, score: opener.score?.fullTime, espnEventId: opener.espnEventId } : null,
  });
}
