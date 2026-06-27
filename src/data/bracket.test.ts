import { describe, expect, it } from 'vitest';
import type { Match } from '../types';
import { resolveKnockoutMatchTeams } from './bracket';

function match(
  id: string,
  group: string | undefined,
  team1: string,
  score1: number | undefined,
  team2: string,
  score2: number | undefined,
): Match {
  return {
    id,
    round: group ? 'Group stage' : 'Round of 32',
    phase: group ? 'group' : 'knockout',
    group,
    date: new Date('2026-06-28T19:00:00Z'),
    utcDate: new Date('2026-06-28T19:00:00Z'),
    team1,
    team2,
    score1,
    score2,
    venue: 'Test',
    city: 'Test',
    tvChannels: {},
    status: score1 === undefined || score2 === undefined ? 'upcoming' : 'ft',
  };
}

describe('resolveKnockoutMatchTeams', () => {
  it('resolves group-place knockout placeholders once group standings are complete', () => {
    const matches: Match[] = [
      match('a1', 'Group A', 'Mexico', 3, 'South Africa', 0),
      match('a2', 'Group A', 'Mexico', 2, 'South Korea', 0),
      match('a3', 'Group A', 'South Africa', 1, 'South Korea', 0),
      match('b1', 'Group B', 'Canada', 2, 'Qatar', 0),
      match('b2', 'Group B', 'Canada', 1, 'Switzerland', 0),
      match('b3', 'Group B', 'Qatar', 0, 'Switzerland', 3),
      { ...match('m73', undefined, '2A', undefined, '2B', undefined), num: 73 },
    ];

    expect(resolveKnockoutMatchTeams(matches).get('m73')).toEqual({
      team1: 'South Africa',
      team2: 'Switzerland',
    });
  });

  it('keeps placeholders when the source group is not complete', () => {
    const matches: Match[] = [
      match('a1', 'Group A', 'Mexico', 3, 'South Africa', 0),
      match('a2', 'Group A', 'Mexico', undefined, 'South Korea', undefined),
      { ...match('m73', undefined, '2A', undefined, '2B', undefined), num: 73 },
    ];

    expect(resolveKnockoutMatchTeams(matches).get('m73')).toEqual({
      team1: '2A',
      team2: '2B',
    });
  });
});
