import { describe, it, expect } from 'vitest';
import { mapStatus } from './useLiveScores';

// mapStatus is a straight lookup over the poller's feed-authoritative status.
// Half-time is the poller's PAUSED (ESPN STATUS_HALFTIME / football-data PAUSED /
// API-Football HT) — NOT re-derived from the minute. The old minute ∈ [45,50] →
// 'ht' heuristic was removed because it mislabelled a genuine early second half
// (or 45+stoppage while a feed still reports IN_PLAY) as half-time.
describe('mapStatus', () => {
  it('maps any IN_PLAY to live, regardless of minute', () => {
    expect(mapStatus('IN_PLAY')).toBe('live');
    expect(mapStatus('IN_PLAY')).toBe('live'); // formerly mislabelled in the 45–50' window
  });

  it('maps PAUSED to half-time', () => {
    expect(mapStatus('PAUSED')).toBe('ht');
  });

  it('maps FINISHED to full-time', () => {
    expect(mapStatus('FINISHED')).toBe('ft');
  });

  it('maps everything else to upcoming', () => {
    expect(mapStatus('TIMED')).toBe('upcoming');
    expect(mapStatus('SCHEDULED')).toBe('upcoming');
    expect(mapStatus('POSTPONED')).toBe('upcoming');
    expect(mapStatus('CANCELLED')).toBe('upcoming');
  });
});
