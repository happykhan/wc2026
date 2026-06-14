import { describe, it, expect } from 'vitest';
import { parseKickoffUtc, makeIdAssigner } from './fixturesLib.mjs';

describe('fixturesLib: parseKickoffUtc', () => {
  it('converts a local kickoff (UTC-6) to the correct UTC instant', () => {
    // 13:00 in UTC-6 is 19:00 UTC the same day.
    expect(parseKickoffUtc('2026-06-11', '13:00 UTC-6').toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });
  it('handles a UTC-4 evening kickoff that rolls into the next UTC day', () => {
    // 21:00 in UTC-4 is 01:00 UTC the following day.
    expect(parseKickoffUtc('2026-06-12', '21:00 UTC-4').toISOString()).toBe('2026-06-13T01:00:00.000Z');
  });
  it('handles half-hour kickoff times', () => {
    expect(parseKickoffUtc('2026-06-20', '20:30 UTC-5').toISOString()).toBe('2026-06-21T01:30:00.000Z');
  });
  it('returns null for a missing date or time (knockout TBD rows)', () => {
    expect(parseKickoffUtc(undefined, '13:00 UTC-6')).toBeNull();
    expect(parseKickoffUtc('2026-06-11', undefined)).toBeNull();
    expect(parseKickoffUtc('2026-06-11', 'TBD')).toBeNull();
  });
});

describe('fixturesLib: makeIdAssigner (app match-id scheme)', () => {
  it('uses m{num} for numbered knockout matches', () => {
    const id = makeIdAssigner();
    expect(id({ num: 73, round: 'Round of 32', team1: 'A', team2: 'B' })).toBe('m73');
  });
  it('uses a running counter m1.. for group matches in order', () => {
    const id = makeIdAssigner();
    expect(id({ group: 'Group A', round: 'Group A', team1: 'A', team2: 'B' })).toBe('m1');
    expect(id({ group: 'Group A', round: 'Group A', team1: 'C', team2: 'D' })).toBe('m2');
  });
  it('does not advance the counter on numbered/slug rows', () => {
    const id = makeIdAssigner();
    expect(id({ group: 'Group A', round: 'Group A' })).toBe('m1');
    expect(id({ num: 90, round: 'Quarter-final' })).toBe('m90');
    expect(id({ group: 'Group A', round: 'Group A' })).toBe('m2'); // counter unaffected by m90
  });
  it('slugs the un-numbered, group-less final / third-place rows', () => {
    const id = makeIdAssigner();
    expect(id({ round: 'Final' })).toBe('m-final');
    expect(id({ round: 'Match for third place' })).toBe('m-match-for-third-place');
  });
});
