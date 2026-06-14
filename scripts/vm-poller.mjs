#!/usr/bin/env node
// VM-hosted live-scores poller. Runs on Nabil's box (cron, every ~30s). Builds a
// base from the static fixtures, overlays ESPN (primary live feed), then falls
// back to football-data.org for any match ESPN didn't resolve — a second source
// whose different spellings catch what ESPN renders differently. Writes
// scores.json, served publicly by vm-server.mjs over its own cloudflared tunnel.
import fs from 'fs';
import path from 'path';
import { pairKey, hasScore, espnStatus, espnMinute, espnDateStrings, fdStatus, aflStatus, matchWindow, isResolved, haveFinalScore, orient } from './pollerLib.mjs';
import { parseKickoffUtc } from './fixturesLib.mjs';

const DATA_DIR = '/home/nabil/wc2026-data';
const DATA_FILE = path.join(DATA_DIR, 'scores.json');
const ENV_FILE = path.join(DATA_DIR, 'poller.env');
const FIXTURES = '/home/nabil/projects/wc2026/src/data/fixtures.json';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const FD_BASE = 'https://api.football-data.org/v4/competitions/2000/matches'; // 2000 = FIFA World Cup
const LIVE_WINDOW_MIN = 150;

// Keys live in poller.env. They were written with a trailing literal "\n", so
// strip non-key chars defensively.
function loadEnv() {
  try {
    const env = {};
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^(\w+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/\\n/g, '').replace(/["'\s]/g, '').trim();
    }
    return env;
  } catch { return {}; }
}
const ENV = loadEnv();

// Fallback feed: football-data.org. Used only for matches ESPN didn't resolve —
// its different (English) spellings catch names ESPN renders differently
// ("Türkiye" vs "Turkey"). Free tier rate limit is 10/min; we call it at most
// once per poll and only when something is unresolved, so it stays well under.
async function fetchFootballData(dates) {
  const key = ENV.FOOTBALL_DATA_KEY;
  if (!key || dates.size === 0) return [];
  const ds = [...dates].sort();
  const fmt = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  try {
    const r = await fetch(`${FD_BASE}?dateFrom=${fmt(ds[0])}&dateTo=${fmt(ds[ds.length - 1])}`, {
      headers: { 'X-Auth-Token': key },
    });
    if (!r.ok) return [];
    return (await r.json()).matches ?? [];
  } catch { return []; }
}

// API-Football: hard 100/day free cap, so keep a persisted daily budget and only
// call as a last resort for a live match neither ESPN nor football-data resolved.
const AFL_USAGE = path.join(DATA_DIR, 'afl-usage.json');
const AFL_DAILY_CAP = 90;
function aflBudgetOk() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const u = JSON.parse(fs.readFileSync(AFL_USAGE, 'utf8'));
    return u.date !== today || (u.count ?? 0) < AFL_DAILY_CAP;
  } catch { return true; }
}
function aflRecordCall() {
  const today = new Date().toISOString().slice(0, 10);
  let u = { date: today, count: 0 };
  try { const p = JSON.parse(fs.readFileSync(AFL_USAGE, 'utf8')); if (p.date === today) u = p; } catch { /* */ }
  u.count = (u.count ?? 0) + 1;
  try { fs.writeFileSync(AFL_USAGE, JSON.stringify(u)); } catch { /* */ }
}
async function fetchApiFootballLive() {
  const key = ENV.AFL_API_KEY;
  if (!key) return [];
  try {
    const r = await fetch('https://v3.football.api-sports.io/fixtures?live=all', { headers: { 'x-apisports-key': key } });
    if (!r.ok) return [];
    aflRecordCall();
    return (await r.json()).response ?? [];
  } catch { return []; }
}

// Build the base match list from the static fixtures (schedule), parsing
// "2026-06-11" + "13:00 UTC-6" into a UTC timestamp. No external base API needed.
function buildBase() {
  const fx = JSON.parse(fs.readFileSync(FIXTURES, 'utf8')).matches;
  return fx.map((m, i) => {
    const kickoff = parseKickoffUtc(m.date, m.time);
    return {
      id: `fx${i}`,
      utcDate: kickoff ? kickoff.toISOString() : null,
      status: 'TIMED',
      minute: null,
      score: { fullTime: { home: null, away: null } },
      homeTeam: { name: m.team1 },
      awayTeam: { name: m.team2 },
      group: m.group ?? null,
      round: m.round ?? null,
    };
  });
}

function readPrior() { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return null; } }

async function fetchEspnDates(dates) {
  const out = [];
  for (const d of dates) {
    try { const r = await fetch(`${ESPN}?dates=${d}`); if (r.ok) out.push(...((await r.json()).events ?? [])); } catch { /* */ }
  }
  return out;
}

async function main() {
  const now = Date.now();
  const matches = buildBase();
  const prior = readPrior();
  if (matches.length === 0) { console.log(new Date(now).toISOString(), 'no fixtures — skip'); return; }

  // Key prior by team-pair (not id) so carry-forward works even when seeded from
  // a different source (e.g. the old Vercel data with football-data ids).
  const priorById = new Map((prior?.matches ?? []).map((m) => [pairKey(m.homeTeam?.name, m.awayTeam?.name), m]));
  const priorOf = (m) => priorById.get(pairKey(m.homeTeam?.name, m.awayTeam?.name));

  // Decide which dates to hit ESPN for. Live now → yes. Past match without a
  // confirmed final result → keep retrying (BACKFILL) so a missed result (poller
  // downtime, ESPN lag, a team-name mismatch) self-heals instead of sticking on
  // the kickoff time forever. Once a match has a final score it stops being
  // fetched, so this stays gentle on ESPN.
  const BACKFILL_WINDOW_MS = 3 * 24 * 60 * 60000; // keep trying for 3 days post-kickoff
  const needDates = new Set();
  for (const m of matches) {
    const { kickoffMs, liveNow, withinBackfill } = matchWindow(m.utcDate, now, LIVE_WINDOW_MIN, BACKFILL_WINDOW_MS);
    if (Number.isNaN(kickoffMs)) continue;
    const p = priorOf(m);
    // Keep fetching until we have BOTH a final score AND the ESPN event id — the
    // id is what the lineups/stats/timeline panels load from. A score resolved by
    // football-data alone has no event id, so the timeline would be empty.
    const haveEspnId = !!m.espnEventId || !!p?.espnEventId;
    const needsBackfill = withinBackfill && (!haveFinalScore(m, p) || !haveEspnId);
    // ESPN files each game under its US-LOCAL date (see espnDateStrings) — fetch
    // ±1 day; team-pair matching ignores the extra events harmlessly.
    if (liveNow || needsBackfill) for (const d of espnDateStrings(kickoffMs)) needDates.add(d);
  }

  let usedEspn = false;
  // DISABLE_ESPN=1 forces the football-data fallback (operational kill-switch if
  // ESPN ever rate-limits us, and how the fallback path is tested).
  const espnDisabled = process.env.DISABLE_ESPN || ENV.DISABLE_ESPN;
  if (needDates.size && !espnDisabled) {
    const events = await fetchEspnDates([...needDates]);
    const byPair = new Map();
    for (const ev of events) {
      const c = ev.competitions?.[0];
      const h = c?.competitors?.find((x) => x.homeAway === 'home');
      const a = c?.competitors?.find((x) => x.homeAway === 'away');
      if (!h?.team?.displayName || !a?.team?.displayName) continue;
      byPair.set(pairKey(h.team.displayName, a.team.displayName), { ev, hName: h.team.displayName, hScore: parseInt(h.score ?? '', 10), aScore: parseInt(a.score ?? '', 10) });
    }
    for (const m of matches) {
      const hit = byPair.get(pairKey(m.homeTeam?.name, m.awayTeam?.name));
      if (!hit) continue;
      const st = espnStatus(hit.ev); if (!st) continue;
      const hs = Number.isNaN(hit.hScore) ? null : hit.hScore;
      const as = Number.isNaN(hit.aScore) ? null : hit.aScore;
      m.status = st;
      m.minute = espnMinute(hit.ev);
      m.score = { fullTime: orient(m.homeTeam?.name, hit.hName, hs, as) };
      m.espnEventId = hit.ev.id;
      usedEspn = true;
    }
  }

  // Fallback: football-data for any in-window match ESPN didn't resolve. Its
  // English spellings catch names ESPN renders differently (Türkiye vs Turkey),
  // which is exactly how Australia 2-0 Türkiye was silently dropped.
  let usedFd = false;
  const unresolved = matches.filter((m) => {
    const { kickoffMs, liveNow, withinBackfill } = matchWindow(m.utcDate, now, LIVE_WINDOW_MIN, BACKFILL_WINDOW_MS);
    if (Number.isNaN(kickoffMs)) return false;
    const needsBackfill = withinBackfill && !haveFinalScore(m, priorOf(m));
    return (liveNow || needsBackfill) && !isResolved(m.status);
  });
  if (unresolved.length) {
    const fdMatches = await fetchFootballData(needDates);
    const byPair = new Map();
    for (const x of fdMatches) {
      if (x.homeTeam?.name && x.awayTeam?.name) byPair.set(pairKey(x.homeTeam.name, x.awayTeam.name), x);
    }
    for (const m of unresolved) {
      const hit = byPair.get(pairKey(m.homeTeam?.name, m.awayTeam?.name));
      if (!hit) continue;
      const st = fdStatus(hit.status); if (!st) continue;
      const ft = hit.score?.fullTime ?? {};
      const hs = ft.home ?? null, as = ft.away ?? null;
      if (st === 'FINISHED' && hs == null && as == null) continue; // no usable score
      m.status = st;
      m.score = { fullTime: orient(m.homeTeam?.name, hit.homeTeam?.name, hs, as) };
      if (hit.minute != null) m.minute = hit.minute;
      usedFd = true;
    }
  }

  // Third fallback: API-Football for a LIVE match neither ESPN nor football-data
  // resolved (its free tier does live in-play but not history). Budget-guarded
  // against the hard 100/day cap, so it only fires as a genuine last resort.
  let usedAfl = false;
  const stillLiveUnresolved = matches.filter((m) => {
    const { liveNow } = matchWindow(m.utcDate, now, LIVE_WINDOW_MIN, BACKFILL_WINDOW_MS);
    return liveNow && !isResolved(m.status);
  });
  if (stillLiveUnresolved.length && aflBudgetOk()) {
    const fixtures = await fetchApiFootballLive();
    const byPair = new Map();
    for (const f of fixtures) {
      if (f.teams?.home?.name && f.teams?.away?.name) byPair.set(pairKey(f.teams.home.name, f.teams.away.name), f);
    }
    for (const m of stillLiveUnresolved) {
      const hit = byPair.get(pairKey(m.homeTeam?.name, m.awayTeam?.name));
      if (!hit) continue;
      const st = aflStatus(hit.fixture?.status?.short); if (!st) continue;
      const hs = hit.goals?.home ?? null, as = hit.goals?.away ?? null;
      m.status = st;
      m.score = { fullTime: orient(m.homeTeam?.name, hit.teams.home.name, hs, as) };
      if (hit.fixture?.status?.elapsed != null) m.minute = hit.fixture.status.elapsed;
      usedAfl = true;
    }
  }

  // Carry a seen score/status forward so a blank fetch never erases it.
  if (prior) {
    for (const m of matches) {
      const p = priorOf(m);
      if (!p) continue;
      const priorResult = isResolved(p.status) || hasScore(p.score);
      const currentBlank = !m.status || m.status === 'TIMED' || m.status === 'SCHEDULED' || !hasScore(m.score);
      if (priorResult && currentBlank) {
        m.status = p.status; m.minute = p.minute; m.score = p.score;
        if (p.aflFixtureId) m.aflFixtureId = p.aflFixtureId;
        if (p.espnEventId) m.espnEventId = p.espnEventId;
        if ((m.status === 'IN_PLAY' || m.status === 'PAUSED') && m.utcDate && now > Date.parse(m.utcDate) + LIVE_WINDOW_MIN * 60000) m.status = 'FINISHED';
      } else {
        if (p.aflFixtureId && !m.aflFixtureId) m.aflFixtureId = p.aflFixtureId;
        if (p.espnEventId && !m.espnEventId) m.espnEventId = p.espnEventId;
      }
    }
  }

  // Per-match minute anchor: stamp WHEN each live match's minute last changed and
  // carry it forward while the minute is unchanged. The client extrapolates a
  // smooth MM:SS clock from this — anchoring on minute-change (not the blob's
  // updatedAt, which advances every poll) means the clock keeps counting up
  // through stoppage (when the feed minute plateaus at 90') instead of jumping
  // backwards each poll.
  const nowIso = new Date(now).toISOString();
  for (const m of matches) {
    if (m.status !== 'IN_PLAY' || m.minute == null) continue;
    const p = priorOf(m);
    m.minuteAt = p && p.minuteAt && p.minute === m.minute ? p.minuteAt : nowIso;
  }

  const live = matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const data = { updatedAt: new Date(now).toISOString(), live, matches, standings: [] };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(data));
  fs.renameSync(DATA_FILE + '.tmp', DATA_FILE); // atomic
  console.log(new Date(now).toISOString(), 'wrote', matches.length, 'matches | live=' + live, 'usedEspn=' + usedEspn, 'usedFd=' + usedFd, 'usedAfl=' + usedAfl, 'dates=' + [...needDates]);
}
main().catch((e) => { console.error('poller error', e?.message); process.exit(1); });
