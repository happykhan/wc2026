#!/usr/bin/env node
// VM-hosted live-scores poller. Runs on Nabil's box (cron, every ~30s). Builds a
// base from the static fixtures, overlays ESPN (primary live feed), then falls
// back to football-data.org for any match ESPN didn't resolve — a second source
// whose different spellings catch what ESPN renders differently. Writes
// scores.json, served publicly by vm-server.mjs over its own cloudflared tunnel.
import fs from 'fs';
import path from 'path';
import { pairKey, hasScore, espnStatus, espnMinute, espnDateStrings, fdStatus, aflStatus, matchWindow, isResolved, haveFinalScore, matchEspnEventToFixture, compareEspnFixtureMatches, futureDiscoveryEligible, discoveryBucket, espnCandidateDetails, buildEspnSlotLookup, espnBindingKey, espnEventBindingKey } from './pollerLib.mjs';
import { parseKickoffUtc, makeIdAssigner } from './fixturesLib.mjs';
import { resolveKnockoutTeams } from './knockoutLib.mjs';
import { scrapeLiveFootballOnTvWorldCup } from './ukTvScheduleLib.mjs';

const DATA_DIR = '/home/nabil/wc2026-data';
const DATA_FILE = path.join(DATA_DIR, 'scores.json');
const ENV_FILE = path.join(DATA_DIR, 'poller.env');
const FIXTURES = '/home/nabil/projects/wc2026/src/data/fixtures.json';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const FD_BASE = 'https://api.football-data.org/v4/competitions/2000/matches'; // 2000 = FIFA World Cup
const LIVE_WINDOW_MIN = 150;
const BACKFILL_WINDOW_MS = 3 * 24 * 60 * 60000; // keep trying for 3 days post-kickoff
const PREMATCH_WINDOW_MS = 2 * 60 * 60000; // fetch ESPN from 2h before KO (lineups land ~30-60m out)
const FUTURE_DISCOVERY_LOOKAHEAD_MS = 7 * 24 * 60 * 60000;
const FUTURE_DISCOVERY_BUCKET_MS = 6 * 60 * 60000;
const UK_TV_REFRESH_MS = 60 * 60 * 1000; // refresh hourly so late broadcaster swaps land promptly

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
  const assignId = makeIdAssigner();
  return fx.map((m, i) => {
    const kickoff = parseKickoffUtc(m.date, m.time);
    return {
      id: assignId(m),
      num: m.num,
      utcDate: kickoff ? kickoff.toISOString() : null,
      status: 'TIMED',
      minute: null,
      winner: null,
      score: { fullTime: { home: null, away: null }, shootout: { home: null, away: null } },
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
  const nowIso = new Date(now).toISOString();
  const prior = readPrior();
  const previousDiscoveryBucket = prior?.meta?.espnDiscoveryBucket ?? null;
  const currentDiscoveryBucket = discoveryBucket(now, FUTURE_DISCOVERY_BUCKET_MS);
  const runFutureDiscovery = previousDiscoveryBucket !== currentDiscoveryBucket;
  const matches = resolveKnockoutTeams(buildBase(), prior?.matches ?? []);
  const slotLookup = buildEspnSlotLookup(matches);
  if (matches.length === 0) { console.log(new Date(now).toISOString(), 'no fixtures — skip'); return; }

  let ukTvSchedule = prior?.ukTvSchedule ?? {};
  let ukTvUpdatedAt = prior?.ukTvUpdatedAt ?? null;
  const lastUkTvFetchMs = ukTvUpdatedAt ? Date.parse(ukTvUpdatedAt) : NaN;
  const shouldRefreshUkTv = !ukTvUpdatedAt || Number.isNaN(lastUkTvFetchMs) || (now - lastUkTvFetchMs >= UK_TV_REFRESH_MS);
  if (shouldRefreshUkTv) {
    try {
      const scraped = await scrapeLiveFootballOnTvWorldCup();
      if (Object.keys(scraped).length > 0) {
        ukTvSchedule = { ...ukTvSchedule, ...scraped };
        ukTvUpdatedAt = new Date(now).toISOString();
      }
    } catch (err) {
      console.warn(new Date(now).toISOString(), 'uk tv scrape failed', err?.message ?? err);
    }
  }

  // Key prior by team-pair (not id) so carry-forward works even when seeded from
  // a different source (e.g. the old Vercel data with football-data ids).
  const priorByMatchId = new Map((prior?.matches ?? []).map((m) => [m.id, m]));
  const priorByPair = new Map((prior?.matches ?? []).map((m) => [pairKey(m.homeTeam?.name, m.awayTeam?.name), m]));
  const priorOf = (m) => priorByMatchId.get(m.id) ?? priorByPair.get(pairKey(m.homeTeam?.name, m.awayTeam?.name));
  const priorBindings = prior?.meta?.espnBindings ?? {};
  const espnBindings = { ...priorBindings };

  // Decide which dates to hit ESPN for. Live now → yes. Past match without a
  // confirmed final result → keep retrying (BACKFILL) so a missed result (poller
  // downtime, ESPN lag, a team-name mismatch) self-heals instead of sticking on
  // the kickoff time forever. Imminent kickoff (PRE-MATCH window) → yes too, so we
  // attach espnEventId before the match starts and the lineup panel can show the
  // teamsheets ESPN publishes ~30-60 min before KO. Once a match has a final score
  // it stops being fetched, so this stays gentle on ESPN.
  const needDates = new Set();
  const futureDiscoveryMatches = [];
  for (const m of matches) {
    const { kickoffMs, preMatch, liveNow, withinBackfill } = matchWindow(m.utcDate, now, LIVE_WINDOW_MIN, BACKFILL_WINDOW_MS, PREMATCH_WINDOW_MS);
    if (Number.isNaN(kickoffMs)) continue;
    const p = priorOf(m);
    // Keep fetching until we have BOTH a final score AND the ESPN event id — the
    // id is what the lineups/stats/timeline panels load from. A score resolved by
    // football-data alone has no event id, so the timeline would be empty.
    const haveEspnId = !!m.espnEventId || !!p?.espnEventId;
    const needsBackfill = withinBackfill && (!haveFinalScore(m, p) || !haveEspnId);
    // Pre-match: fetch only until we have the id (don't re-poll a fixture that
    // already carries one), so the imminent-KO window stays cheap on ESPN.
    const needsPrematchId = preMatch && !haveEspnId;
    const needsFutureIdRefresh =
      runFutureDiscovery &&
      !haveEspnId &&
      futureDiscoveryEligible(m.utcDate, now, FUTURE_DISCOVERY_LOOKAHEAD_MS);
    // ESPN files each game under its US-LOCAL date (see espnDateStrings) — fetch
    // ±1 day; team-pair matching ignores the extra events harmlessly.
    if (liveNow || needsBackfill || needsPrematchId || needsFutureIdRefresh) {
      for (const d of espnDateStrings(kickoffMs)) needDates.add(d);
    }
    if (needsFutureIdRefresh) futureDiscoveryMatches.push(m);
  }

  let usedEspn = false;
  // DISABLE_ESPN=1 forces the football-data fallback (operational kill-switch if
  // ESPN ever rate-limits us, and how the fallback path is tested).
  const espnDisabled = process.env.DISABLE_ESPN || ENV.DISABLE_ESPN;
  if (needDates.size && !espnDisabled) {
    const events = await fetchEspnDates([...needDates]);
    const eventsById = new Map(events.map((ev) => [String(ev.id), ev]));
    const eventsByBindingKey = new Map();
    for (const ev of events) {
      const key = espnEventBindingKey(ev, slotLookup);
      if (!key) continue;
      const existing = eventsByBindingKey.get(key);
      if (existing) existing.push(ev);
      else eventsByBindingKey.set(key, [ev]);
    }
    for (const m of matches) {
      const binding = espnBindings[m.id];
      const priorEspnId = binding?.espnEventId || m.espnEventId || priorOf(m)?.espnEventId;
      const byId = priorEspnId ? eventsById.get(String(priorEspnId)) : null;
      const matchBinding = espnBindingKey(m.homeTeam?.name, m.awayTeam?.name, slotLookup);
      const byBinding = !byId && matchBinding ? eventsByBindingKey.get(matchBinding)?.[0] ?? null : null;
      const hit = byId
        ? matchEspnEventToFixture(m, byId, { skipKickoffCheck: true })
        : byBinding
          ? matchEspnEventToFixture(m, byBinding, { skipKickoffCheck: true })
          : events
            .map((ev) => matchEspnEventToFixture(m, ev, { relaxedKickoffCheck: true }))
            .filter(Boolean)
            .sort(compareEspnFixtureMatches)[0];
      if (!hit && !byBinding) continue;
      // Always attach the ESPN event id once the match is matched — this is what
      // the lineups/stats/timeline panels load from. We set it even for a
      // STATUS_SCHEDULED (pre-match) game, whose espnStatus is null, so the
      // pre-match lineup panel can show the teamsheets before kickoff. Status and
      // score are only overwritten once ESPN reports a live/finished state.
      const boundEvent = hit?.event ?? byBinding;
      const boundId = String(hit?.id ?? byBinding?.id ?? '');
      if (!boundId) continue;
      m.espnEventId = boundId;
      if (hit) {
        m.homeTeam.name = hit.homeName;
        m.awayTeam.name = hit.awayName;
      }
      espnBindings[m.id] = {
        espnEventId: boundId,
        boundAt: binding?.espnEventId === boundId ? binding.boundAt ?? nowIso : nowIso,
        source: byId ? 'event-id' : byBinding ? 'binding-key' : 'fixture-match',
        bindingKey: matchBinding ?? null,
      };
      usedEspn = true;
      const st = espnStatus(boundEvent); if (!st || !hit) continue;
      const hs = Number.isNaN(hit.homeScore) ? null : hit.homeScore;
      const as = Number.isNaN(hit.awayScore) ? null : hit.awayScore;
      m.status = st;
      m.minute = espnMinute(hit.event);
      m.winner = hit.winner;
      m.score = {
        fullTime: { home: hs, away: as },
        shootout: { home: hit.shootoutHome ?? null, away: hit.shootoutAway ?? null },
      };
    }

    if (runFutureDiscovery) {
      for (const m of futureDiscoveryMatches) {
        if (m.espnEventId) continue;
        const candidates = events
          .map((ev) => espnCandidateDetails(m, ev))
          .filter((c) => c && (c.direct || c.knownSideMatch))
          .sort((a, b) => {
            const aScore = (a.direct ? 0 : 1) + (a.kickoffDeltaMin ?? 99999);
            const bScore = (b.direct ? 0 : 1) + (b.kickoffDeltaMin ?? 99999);
            return aScore - bScore;
          })
          .slice(0, 3);
        if (candidates.length) {
          console.log(
            new Date(now).toISOString(),
            'unresolved future ESPN id',
            m.id,
            `${m.homeTeam?.name} vs ${m.awayTeam?.name}`,
            JSON.stringify(candidates),
          );
        }
      }
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
      m.winner = hs != null && as != null && hs !== as ? (hs > as ? 1 : 2) : null;
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
      m.winner = hs != null && as != null && hs !== as ? (hs > as ? 1 : 2) : null;
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
        if (p.winner != null) m.winner = p.winner;
        if (p.aflFixtureId) m.aflFixtureId = p.aflFixtureId;
        if (p.espnEventId) m.espnEventId = p.espnEventId;
        if ((m.status === 'IN_PLAY' || m.status === 'PAUSED') && m.utcDate && now > Date.parse(m.utcDate) + LIVE_WINDOW_MIN * 60000) m.status = 'FINISHED';
      } else {
        if (p.winner != null && m.winner == null) m.winner = p.winner;
        if (
          p.score?.shootout &&
          (m.score?.shootout?.home == null || m.score?.shootout?.away == null)
        ) {
          m.score = { ...m.score, shootout: p.score.shootout };
        }
        if (p.aflFixtureId && !m.aflFixtureId) m.aflFixtureId = p.aflFixtureId;
        if (p.espnEventId && !m.espnEventId) m.espnEventId = p.espnEventId;
      }
      if (m.espnEventId) {
        const binding = espnBindings[m.id];
        espnBindings[m.id] = {
          espnEventId: m.espnEventId,
          boundAt: binding?.espnEventId === m.espnEventId ? binding.boundAt ?? nowIso : nowIso,
          source: binding?.source ?? (p?.espnEventId === m.espnEventId ? 'carry-forward' : 'fixture-match'),
          bindingKey: binding?.bindingKey ?? espnBindingKey(m.homeTeam?.name, m.awayTeam?.name, slotLookup),
        };
      }
    }
  }

  // Per-match minute anchor: stamp WHEN each live match's minute last changed and
  // carry it forward while the minute is unchanged. The client extrapolates a
  // smooth MM:SS clock from this — anchoring on minute-change (not the blob's
  // updatedAt, which advances every poll) means the clock keeps counting up
  // through stoppage (when the feed minute plateaus at 90') instead of jumping
  // backwards each poll.
  for (const m of matches) {
    if (m.status !== 'IN_PLAY' || m.minute == null) continue;
    const p = priorOf(m);
    m.minuteAt = p && p.minuteAt && p.minute === m.minute ? p.minuteAt : nowIso;
  }

  const live = matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const data = {
    updatedAt: new Date(now).toISOString(),
    live,
    matches,
    ukTvSchedule,
    ukTvUpdatedAt,
    standings: [],
    meta: { espnDiscoveryBucket: currentDiscoveryBucket, espnBindings },
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(data));
  fs.renameSync(DATA_FILE + '.tmp', DATA_FILE); // atomic
  console.log(new Date(now).toISOString(), 'wrote', matches.length, 'matches | live=' + live, 'usedEspn=' + usedEspn, 'usedFd=' + usedFd, 'usedAfl=' + usedAfl, 'futureDiscovery=' + runFutureDiscovery, 'dates=' + [...needDates]);
}
main().catch((e) => { console.error('poller error', e?.message); process.exit(1); });
