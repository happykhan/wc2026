#!/usr/bin/env node
// VM-hosted live-scores poller. Runs on Nabil's box (cron, every minute),
// fetches football-data (base) + ESPN (live overlay), and writes scores.json to
// a local file served publicly by vm-server.mjs over its own cloudflared tunnel.
// Replaces the Vercel Blob cache — no metered service, unlimited local writes.
import fs from 'fs';
import path from 'path';

const DATA_DIR = '/home/nabil/wc2026-data';
const DATA_FILE = path.join(DATA_DIR, 'scores.json');
const FIXTURES = '/home/nabil/projects/wc2026/src/data/fixtures.json';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const LIVE_WINDOW_MIN = 150;

// Build the base match list from the static fixtures (schedule), parsing
// "2026-06-11" + "13:00 UTC-6" into a UTC timestamp. No external base API needed.
function buildBase() {
  const fx = JSON.parse(fs.readFileSync(FIXTURES, 'utf8')).matches;
  return fx.map((m, i) => {
    let utcDate = null;
    const tm = (m.time || '').match(/(\d{1,2}):(\d{2})\s*UTC([+-]?\d+)?/);
    if (m.date && tm) {
      const [y, mo, d] = m.date.split('-').map(Number);
      const off = tm[3] ? parseInt(tm[3], 10) : 0; // local zone = UTC{off}; UTC = local - off
      utcDate = new Date(Date.UTC(y, mo - 1, d, parseInt(tm[1], 10) - off, parseInt(tm[2], 10))).toISOString();
    }
    return {
      id: `fx${i}`,
      utcDate,
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

const TEAM_ALIASES = {
  czechrepublic: 'czechia', capeverdeislands: 'capeverde', congodr: 'drcongo',
  curacoa: 'curacao', curaao: 'curacao', unitedstates: 'usa',
  korearepublic: 'southkorea', iranislamicrepublic: 'iran', ivorycoast: 'cotedivoire',
};
const norm = (s) => { const n = (s || '').toLowerCase().replace(/[^a-z]/g, ''); return TEAM_ALIASES[n] ?? n; };
const pairKey = (a, b) => [norm(a), norm(b)].sort().join('|');
const hasScore = (s) => !!s?.fullTime && (s.fullTime.home != null || s.fullTime.away != null);

const espnStatus = (ev) => {
  const t = ev.status?.type; if (!t) return null;
  // Right at the whistle ESPN reports state='in' + name=STATUS_FULL_TIME for a
  // minute or two before flipping to state='post' — treat those as finished so
  // the live clock stops immediately instead of ticking past the final whistle.
  if (t.state === 'post' || t.completed || /FULL_TIME|FINAL|\bFT\b|ENDED|AFTER_/i.test(t.name || '')) return 'FINISHED';
  if (t.state === 'in') return t.name === 'STATUS_HALFTIME' ? 'PAUSED' : 'IN_PLAY';
  return null;
};
const espnMinute = (ev) => { const m = ev.status?.displayClock?.match(/(\d+)/); return m ? parseInt(m[1], 10) : null; };

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

  // ESPN only for matches live now or just finished (avoids burst-banning ESPN).
  const needDates = new Set();
  for (const m of matches) {
    if (!m.utcDate) continue;
    const k = Date.parse(m.utcDate);
    const liveNow = now >= k && now <= k + LIVE_WINDOW_MIN * 60000;
    const p = priorOf(m);
    const haveFinal = (m.status === 'FINISHED' && hasScore(m.score)) || (!!p && p.status === 'FINISHED' && hasScore(p.score));
    const haveEspn = !!m.espnEventId || !!p?.espnEventId;
    const justEnded = now > k + LIVE_WINDOW_MIN * 60000 && now <= k + (LIVE_WINDOW_MIN + 60) * 60000 && (!haveFinal || !haveEspn);
    // ESPN files each game under its US-LOCAL date, not UTC — a 01:00 UTC kickoff
    // (US evening) is listed under the PREVIOUS calendar day. So fetch the match's
    // UTC date ±1 day; team-pair matching ignores the extra events harmlessly.
    if (liveNow || justEnded) {
      for (const off of [-1, 0, 1]) {
        const dt = new Date(k + off * 86400000);
        needDates.add(`${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`);
      }
    }
  }

  let usedEspn = false;
  if (needDates.size) {
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
      const reversed = norm(m.homeTeam?.name) !== norm(hit.hName);
      const hs = Number.isNaN(hit.hScore) ? null : hit.hScore;
      const as = Number.isNaN(hit.aScore) ? null : hit.aScore;
      m.status = st;
      m.minute = espnMinute(hit.ev);
      m.score = { fullTime: reversed ? { home: as, away: hs } : { home: hs, away: as } };
      m.espnEventId = hit.ev.id;
      usedEspn = true;
    }
  }

  // Carry a seen score/status forward so a blank fetch never erases it.
  if (prior) {
    for (const m of matches) {
      const p = priorOf(m);
      if (!p) continue;
      const priorResult = p.status === 'IN_PLAY' || p.status === 'PAUSED' || p.status === 'FINISHED' || hasScore(p.score);
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
  console.log(new Date(now).toISOString(), 'wrote', matches.length, 'matches | live=' + live, 'usedEspn=' + usedEspn, 'dates=' + [...needDates]);
}
main().catch((e) => { console.error('poller error', e?.message); process.exit(1); });
