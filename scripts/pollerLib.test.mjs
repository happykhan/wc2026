import { describe, it, expect } from 'vitest';
import { norm, pairKey, hasScore, espnStatus, espnMinute, espnDateStrings, fdStatus, aflStatus } from './pollerLib.mjs';

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
});
