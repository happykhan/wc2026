import { describe, it, expect } from 'vitest';
import { pickScrollTargetDateKey } from './scrollTarget';

describe('pickScrollTargetDateKey', () => {
  const keys = ['2026-06-11', '2026-06-12', '2026-06-14', '2026-06-15', '2026-07-19'];

  it('returns today when the tournament has matches today', () => {
    expect(pickScrollTargetDateKey(keys, '2026-06-14')).toBe('2026-06-14');
  });

  it('returns the next upcoming day when today has no matches (rest day)', () => {
    // 2026-06-13 is between 06-12 and 06-14 with no matches -> jump forward.
    expect(pickScrollTargetDateKey(keys, '2026-06-13')).toBe('2026-06-14');
  });

  it('returns the next upcoming day before the tournament starts', () => {
    expect(pickScrollTargetDateKey(keys, '2026-06-01')).toBe('2026-06-11');
  });

  it('returns the last day once the whole tournament is over', () => {
    expect(pickScrollTargetDateKey(keys, '2026-08-01')).toBe('2026-07-19');
  });

  it('returns the final day when today IS the final day', () => {
    expect(pickScrollTargetDateKey(keys, '2026-07-19')).toBe('2026-07-19');
  });

  it('does not require the input to be pre-sorted', () => {
    const shuffled = ['2026-07-19', '2026-06-11', '2026-06-15', '2026-06-12', '2026-06-14'];
    expect(pickScrollTargetDateKey(shuffled, '2026-06-13')).toBe('2026-06-14');
  });

  it('returns undefined when there are no dates (empty / filtered-out list)', () => {
    expect(pickScrollTargetDateKey([], '2026-06-14')).toBeUndefined();
  });

  it('handles a single-day list', () => {
    expect(pickScrollTargetDateKey(['2026-06-14'], '2026-06-14')).toBe('2026-06-14');
    expect(pickScrollTargetDateKey(['2026-06-14'], '2026-06-10')).toBe('2026-06-14');
    expect(pickScrollTargetDateKey(['2026-06-14'], '2026-06-20')).toBe('2026-06-14');
  });
});
