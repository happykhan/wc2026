import { describe, it, expect } from 'vitest';
import { mapStatus } from './useLiveScores';

// Characterization test — locks the CURRENT behaviour before any refactor.
// NOTE: the minute ∈ [45,50] → 'ht' rule is a known heuristic (it also labels the
// genuine early second half as half-time). Captured here as-is on purpose; change
// this test deliberately if/when that rule is removed.
describe('mapStatus', () => {
  it('maps an in-play match to live', () => {
    expect(mapStatus('IN_PLAY', 30)).toBe('live');
    expect(mapStatus('IN_PLAY', 67)).toBe('live');
  });

  it('treats the 45–50 minute window of IN_PLAY as half-time (current heuristic)', () => {
    expect(mapStatus('IN_PLAY', 45)).toBe('ht');
    expect(mapStatus('IN_PLAY', 48)).toBe('ht');
    expect(mapStatus('IN_PLAY', 50)).toBe('ht');
    expect(mapStatus('IN_PLAY', 51)).toBe('live');
  });

  it('maps an in-play match with no minute to live', () => {
    expect(mapStatus('IN_PLAY')).toBe('live');
    expect(mapStatus('IN_PLAY', null)).toBe('live');
  });

  it('maps PAUSED to half-time and FINISHED to full-time', () => {
    expect(mapStatus('PAUSED')).toBe('ht');
    expect(mapStatus('FINISHED')).toBe('ft');
  });

  it('maps everything else to upcoming', () => {
    expect(mapStatus('TIMED')).toBe('upcoming');
    expect(mapStatus('SCHEDULED')).toBe('upcoming');
    expect(mapStatus('POSTPONED')).toBe('upcoming');
    expect(mapStatus('CANCELLED')).toBe('upcoming');
  });
});
