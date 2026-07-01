import { describe, it, expect } from 'vitest';
import { norm, pairKey, hasScore, espnStatus, espnMinute, espnDateStrings, espnShootout, fdStatus, aflStatus, matchWindow, isResolved, haveFinalScore, orient, matchEspnEventToFixture } from './pollerLib.mjs';

const WIN = 150;                       // LIVE_WINDOW_MIN
const BF = 3 * 24 * 60 * 60000;        // BACKFILL_WINDOW_MS
const K = Date.parse('2026-06-15T16:00:00Z');

describe('poller: matchWindow', () => {
  it('flags liveNow inside the live window, not ended/backfill', () => {
    const w = matchWindow('2026-06-15T16:00:00Z', K + 30 * 60000, WIN, BF);
    expect(w).toMatchObject({ liveNow: true, ended: false, withinBackfill: false });
    expect(w.kickoffMs).toBe(K);
  });
  it('treats exactly kickoff and exactly the window edge as live', () => {
    expect(matchWindow('2026-06-15T16:00:00Z', K, WIN, BF).liveNow).toBe(true);
    expect(matchWindow('2026-06-15T16:00:00Z', K + WIN * 60000, WIN, BF).liveNow).toBe(true);
  });
  it('is not live before kickoff', () => {
    expect(matchWindow('2026-06-15T16:00:00Z', K - 1, WIN, BF).liveNow).toBe(false);
  });
  it('ends past the live window and stays in backfill until the backfill window closes', () => {
    const justAfter = matchWindow('2026-06-15T16:00:00Z', K + WIN * 60000 + 1, WIN, BF);
    expect(justAfter).toMatchObject({ liveNow: false, ended: true, withinBackfill: true });
    const edge = matchWindow('2026-06-15T16:00:00Z', K + WIN * 60000 + BF, WIN, BF);
    expect(edge.withinBackfill).toBe(true);
    const past = matchWindow('2026-06-15T16:00:00Z', K + WIN * 60000 + BF + 1, WIN, BF);
    expect(past).toMatchObject({ ended: true, withinBackfill: false });
  });
  it('returns NaN kickoff / all-false for a missing or unparseable date', () => {
    for (const d of [null, undefined, '', 'not-a-date']) {
      const w = matchWindow(d, K, WIN, BF);
      expect(Number.isNaN(w.kickoffMs)).toBe(true);
      expect(w).toMatchObject({ preMatch: false, liveNow: false, ended: false, withinBackfill: false });
    }
  });
});

describe('poller: matchWindow preMatch (lineup pre-fetch window)', () => {
  const PRE = 2 * 60 * 60000; // PREMATCH_WINDOW_MS = 2h
  it('is preMatch inside [KO - prematchMs, KO), and not live', () => {
    const w = matchWindow('2026-06-15T16:00:00Z', K - 30 * 60000, WIN, BF, PRE);
    expect(w).toMatchObject({ preMatch: true, liveNow: false, ended: false, withinBackfill: false });
  });
  it('includes the leading edge (KO - prematchMs) and excludes kickoff itself', () => {
    expect(matchWindow('2026-06-15T16:00:00Z', K - PRE, WIN, BF, PRE).preMatch).toBe(true);
    // exactly at KO is live, not pre-match (the live gate takes over)
    const atKo = matchWindow('2026-06-15T16:00:00Z', K, WIN, BF, PRE);
    expect(atKo.preMatch).toBe(false);
    expect(atKo.liveNow).toBe(true);
  });
  it('is not preMatch before the window opens', () => {
    expect(matchWindow('2026-06-15T16:00:00Z', K - PRE - 1, WIN, BF, PRE).preMatch).toBe(false);
  });
  it('defaults prematchMs to 0 (off) so the legacy 4-arg call never flags preMatch', () => {
    // Right up against kickoff, with no prematchMs passed, preMatch stays false.
    expect(matchWindow('2026-06-15T16:00:00Z', K - 1, WIN, BF).preMatch).toBe(false);
    expect(matchWindow('2026-06-15T16:00:00Z', K - 30 * 60000, WIN, BF).preMatch).toBe(false);
  });
});

describe('poller: isResolved', () => {
  it('is true for live/paused/finished only', () => {
    expect(isResolved('IN_PLAY')).toBe(true);
    expect(isResolved('PAUSED')).toBe(true);
    expect(isResolved('FINISHED')).toBe(true);
    expect(isResolved('TIMED')).toBe(false);
    expect(isResolved('SCHEDULED')).toBe(false);
    expect(isResolved(undefined)).toBe(false);
  });
});

describe('poller: haveFinalScore', () => {
  const fin = { status: 'FINISHED', score: { fullTime: { home: 2, away: 1 } } };
  it('is true when the current overlay is a finished, scored match', () => {
    expect(haveFinalScore(fin, null)).toBe(true);
  });
  it('is true when only the carried-forward prior is finished+scored', () => {
    expect(haveFinalScore({ status: 'TIMED', score: { fullTime: {} } }, fin)).toBe(true);
  });
  it('is false for finished-but-unscored, or non-finished', () => {
    expect(haveFinalScore({ status: 'FINISHED', score: { fullTime: { home: null, away: null } } }, null)).toBe(false);
    expect(haveFinalScore({ status: 'IN_PLAY', score: { fullTime: { home: 1, away: 0 } } }, null)).toBe(false);
  });
});

describe('poller: orient (home/away swap when the feed reversed the teams)', () => {
  it('keeps order when the feed home matches ours', () => {
    expect(orient('Brazil', 'Brazil', 3, 1)).toEqual({ home: 3, away: 1 });
  });
  it('swaps when the feed listed our away team as home', () => {
    expect(orient('Brazil', 'Argentina', 3, 1)).toEqual({ home: 1, away: 3 });
  });
  it('folds spelling variants before comparing (no false swap)', () => {
    expect(orient('Türkiye', 'Turkey', 2, 0)).toEqual({ home: 2, away: 0 });
    expect(orient('Czech Republic', 'Czechia', 1, 1)).toEqual({ home: 1, away: 1 });
  });
  it('passes nulls through in the chosen orientation', () => {
    expect(orient('Brazil', 'Argentina', null, 2)).toEqual({ home: 2, away: null });
  });
});

describe('poller: fdStatus (football-data fallback)', () => {
  it('maps football-data statuses to ours', () => {
    expect(fdStatus('FINISHED')).toBe('FINISHED');
    expect(fdStatus('IN_PLAY')).toBe('IN_PLAY');
    expect(fdStatus('PAUSED')).toBe('PAUSED');
    expect(fdStatus('TIMED')).toBeNull();
    expect(fdStatus('SCHEDULED')).toBeNull();
  });
});

describe('poller: aflStatus (API-Football fallback)', () => {
  it('maps API-Football short codes to ours', () => {
    expect(aflStatus('1H')).toBe('IN_PLAY');
    expect(aflStatus('2H')).toBe('IN_PLAY');
    expect(aflStatus('HT')).toBe('PAUSED');
    expect(aflStatus('FT')).toBe('FINISHED');
    expect(aflStatus('AET')).toBe('FINISHED');
    expect(aflStatus('PEN')).toBe('FINISHED');
    expect(aflStatus('NS')).toBeNull();
    expect(aflStatus('PST')).toBeNull();
  });
});

describe('poller: espnStatus', () => {
  const ev = (type) => ({ status: { type } });
  it('maps full-time to FINISHED even while ESPN still says state=in', () => {
    expect(espnStatus(ev({ state: 'in', name: 'STATUS_FULL_TIME', completed: false }))).toBe('FINISHED');
  });
  it('maps state=post / completed to FINISHED', () => {
    expect(espnStatus(ev({ state: 'post', name: 'STATUS_FULL_TIME', completed: true }))).toBe('FINISHED');
    expect(espnStatus(ev({ state: 'in', name: 'STATUS_SECOND_HALF', completed: true }))).toBe('FINISHED');
  });
  it('maps half-time to PAUSED and live play to IN_PLAY', () => {
    expect(espnStatus(ev({ state: 'in', name: 'STATUS_HALFTIME' }))).toBe('PAUSED');
    expect(espnStatus(ev({ state: 'in', name: 'STATUS_FIRST_HALF' }))).toBe('IN_PLAY');
    expect(espnStatus(ev({ state: 'in', name: 'STATUS_SECOND_HALF' }))).toBe('IN_PLAY');
  });
  it('returns null for pre-match / unknown', () => {
    expect(espnStatus(ev({ state: 'pre', name: 'STATUS_SCHEDULED' }))).toBeNull();
    expect(espnStatus({ status: {} })).toBeNull();
  });
});

describe('poller: espnMinute', () => {
  const ev = (displayClock) => ({ status: { displayClock } });
  it('parses whole minutes', () => expect(espnMinute(ev("65'"))).toBe(65));
  it('parses the base minute during stoppage', () => expect(espnMinute(ev("90'+3"))).toBe(90));
  it('returns null when there is no clock', () => {
    expect(espnMinute(ev('FT'))).toBeNull();
    expect(espnMinute({ status: {} })).toBeNull();
  });
});

describe('poller: espnShootout', () => {
  it('extracts shootout scores and winner from a final-pens event', () => {
    const ev = {
      competitions: [{
        competitors: [
          { homeAway: 'home', shootoutScore: 3, winner: false },
          { homeAway: 'away', shootoutScore: 4, winner: true },
        ],
      }],
    };
    expect(espnShootout(ev)).toEqual({
      shootout: { home: 3, away: 4 },
      winner: 2,
    });
  });
});

describe('poller: espnDateStrings (US-local date filing)', () => {
  it('includes the previous US day for a 01:00 UTC (US-evening) kickoff', () => {
    const k = Date.parse('2026-06-13T01:00:00Z');
    expect(espnDateStrings(k)).toEqual(['20260612', '20260613', '20260614']);
  });
  it('handles a midday kickoff', () => {
    const k = Date.parse('2026-06-15T16:00:00Z');
    expect(espnDateStrings(k)).toEqual(['20260614', '20260615', '20260616']);
  });
});

describe('poller: team matching', () => {
  it('folds feed spelling variants to one token', () => {
    expect(norm('Czech Republic')).toBe('czechia');
    expect(norm('Cape Verde Islands')).toBe('capeverde');
    expect(norm("Côte d'Ivoire")).toBe('cotedivoire');
    expect(norm('United States')).toBe('usa');
  });

  // ESPN's real display names (accented/alternate spellings) must fold to the same
  // token as our fixtures, or live results silently fail to merge. These caused
  // production bugs (Côte d'Ivoire, then Türkiye); an audit confirmed all 48 teams
  // match — these lock the tricky ones so they can't regress.
  it('folds ESPN display names to the fixture token', () => {
    expect(norm('Türkiye')).toBe(norm('Turkey'));
    expect(norm("Côte d'Ivoire")).toBe(norm('Ivory Coast'));
    expect(norm('United States')).toBe(norm('USA'));
    expect(norm('Czechia')).toBe(norm('Czech Republic'));
    expect(norm('Korea Republic')).toBe(norm('South Korea'));
    expect(norm('Curaçao')).toBe(norm('Curacoa'));
  });
  it('pairKey is order-independent', () => {
    expect(pairKey('Brazil', 'Argentina')).toBe(pairKey('Argentina', 'Brazil'));
  });
  it('hasScore detects a recorded scoreline', () => {
    expect(hasScore({ fullTime: { home: 1, away: 0 } })).toBe(true);
    expect(hasScore({ fullTime: { home: null, away: null } })).toBe(false);
    expect(hasScore(undefined)).toBe(false);
  });

  it('matches an ESPN round-of-32 event onto a best-third placeholder slot by kickoff + known side', () => {
    const match = {
      utcDate: '2026-06-29T20:30:00.000Z',
      homeTeam: { name: 'Germany' },
      awayTeam: { name: '3A/B/C/D/F' },
    };
    const ev = {
      id: '760489',
      competitions: [{
        date: '2026-06-29T20:30Z',
        competitors: [
          { homeAway: 'home', score: '0', team: { displayName: 'Germany' } },
          { homeAway: 'away', score: '0', team: { displayName: 'Paraguay' } },
        ],
      }],
    };
    expect(matchEspnEventToFixture(match, ev)).toMatchObject({
      id: '760489',
      homeName: 'Germany',
      awayName: 'Paraguay',
      homeScore: 0,
      awayScore: 0,
    });
  });

  it('carries shootout scores and winner through for penalty-decided knockout matches', () => {
    const match = {
      utcDate: '2026-06-29T20:30:00.000Z',
      homeTeam: { name: 'Germany' },
      awayTeam: { name: '3A/B/C/D/F' },
    };
    const ev = {
      id: '760489',
      competitions: [{
        date: '2026-06-29T20:30Z',
        competitors: [
          { homeAway: 'home', score: '1', shootoutScore: 3, winner: false, team: { displayName: 'Germany' } },
          { homeAway: 'away', score: '1', shootoutScore: 4, winner: true, team: { displayName: 'Paraguay' } },
        ],
      }],
    };
    expect(matchEspnEventToFixture(match, ev)).toMatchObject({
      homeScore: 1,
      awayScore: 1,
      shootoutHome: 3,
      shootoutAway: 4,
      winner: 2,
    });
  });

  it('accepts a one-hour kickoff drift when a knockout placeholder has one resolved side', () => {
    const match = {
      utcDate: '2026-07-01T01:00:00.000Z',
      homeTeam: { name: 'Mexico' },
      awayTeam: { name: '3C/E/F/H/I' },
    };
    const ev = {
      id: '760491',
      competitions: [{
        date: '2026-07-01T02:00Z',
        competitors: [
          { homeAway: 'home', score: '2', team: { displayName: 'Mexico' } },
          { homeAway: 'away', score: '0', team: { displayName: 'Ecuador' } },
        ],
      }],
    };
    expect(matchEspnEventToFixture(match, ev)).toMatchObject({
      id: '760491',
      homeName: 'Mexico',
      awayName: 'Ecuador',
      homeScore: 2,
      awayScore: 0,
    });
  });

  it('still rejects stale same-team candidates from previous rounds', () => {
    const match = {
      utcDate: '2026-07-04T17:00:00.000Z',
      homeTeam: { name: 'Canada' },
      awayTeam: { name: 'W75' },
    };
    const ev = {
      id: '760486',
      competitions: [{
        date: '2026-06-28T19:00Z',
        competitors: [
          { homeAway: 'home', score: '0', team: { displayName: 'South Africa' } },
          { homeAway: 'away', score: '1', team: { displayName: 'Canada' } },
        ],
      }],
    };
    expect(matchEspnEventToFixture(match, ev)).toBeNull();
  });
});
