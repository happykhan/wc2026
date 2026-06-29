import { describe, expect, it } from 'vitest';
import { buildPathSteps, type PathSelection } from './bracketPath';
import type { BracketMatch, BracketRound } from './bracket';

function match(overrides: Partial<BracketMatch> & Pick<BracketMatch, 'matchId' | 'round' | 'utcDate' | 'sourceTeam1' | 'sourceTeam2' | 'team1' | 'team2' | 'status'>): BracketMatch {
  return {
    score1: undefined,
    score2: undefined,
    projected: false,
    ...overrides,
  };
}

const utcDate = new Date('2026-07-01T16:00:00.000Z');

describe('buildPathSteps', () => {
  it('shows the whole projected journey for a team still in contention', () => {
    const rounds: BracketRound[] = [
      {
        key: 'r32',
        title: 'Round of 32',
        matches: [
          match({
            matchId: 'm80',
            num: 80,
            round: 'Round of 32',
            utcDate,
            sourceTeam1: '1A',
            sourceTeam2: '2B',
            team1: { label: 'Canada', resolved: true },
            team2: { label: 'Senegal', resolved: true },
            status: 'upcoming',
          }),
        ],
      },
      {
        key: 'r16',
        title: 'Round of 16',
        matches: [
          match({
            matchId: 'm88',
            num: 88,
            round: 'Round of 16',
            utcDate,
            sourceTeam1: 'W80',
            sourceTeam2: 'W81',
            team1: { label: 'Canada', resolved: true, projected: true },
            team2: { label: 'Brazil', resolved: true, projected: true },
            status: 'upcoming',
            projected: true,
          }),
        ],
      },
      {
        key: 'qf',
        title: 'Quarter-finals',
        matches: [
          match({
            matchId: 'm96',
            num: 96,
            round: 'Quarter-final',
            utcDate,
            sourceTeam1: 'W88',
            sourceTeam2: 'W89',
            team1: { label: 'Canada', resolved: true, projected: true },
            team2: { label: 'Argentina', resolved: true, projected: true },
            status: 'upcoming',
            projected: true,
          }),
        ],
      },
    ];

    const selection: PathSelection = { matchId: 'm88', side: 1 };
    const steps = buildPathSteps(rounds, selection);

    expect(steps.map((step) => step.match.matchId)).toEqual(['m80', 'm88', 'm96']);
    expect(steps.map((step) => step.focusSide)).toEqual([1, 1, 1]);
  });

  it('stops at the elimination point for a knocked-out side', () => {
    const rounds: BracketRound[] = [
      {
        key: 'r32',
        title: 'Round of 32',
        matches: [
          match({
            matchId: 'm80',
            num: 80,
            round: 'Round of 32',
            utcDate,
            sourceTeam1: '1A',
            sourceTeam2: '2B',
            team1: { label: 'South Africa', resolved: true },
            team2: { label: 'Germany', resolved: true },
            score1: 0,
            score2: 2,
            status: 'ft',
            winner: 2,
          }),
        ],
      },
      {
        key: 'r16',
        title: 'Round of 16',
        matches: [
          match({
            matchId: 'm88',
            num: 88,
            round: 'Round of 16',
            utcDate,
            sourceTeam1: 'W80',
            sourceTeam2: 'W81',
            team1: { label: 'Germany', resolved: true },
            team2: { label: 'Brazil', resolved: true, projected: true },
            status: 'upcoming',
            projected: true,
          }),
        ],
      },
    ];

    const selection: PathSelection = { matchId: 'm80', side: 1 };
    const steps = buildPathSteps(rounds, selection);

    expect(steps.map((step) => step.match.matchId)).toEqual(['m80']);
    expect(steps[0]?.focusSide).toBe(1);
  });
});
