import { describe, expect, it } from 'vitest';
import { buildPathSteps, type PathSelection } from './bracketPath';
import { buildBracket, type BracketMatch, type BracketRound } from './bracket';
import type { Match } from '../types';

function match(overrides: Partial<BracketMatch> & Pick<BracketMatch, 'matchId' | 'round' | 'utcDate' | 'sourceTeam1' | 'sourceTeam2' | 'team1' | 'team2' | 'status'>): BracketMatch {
  return {
    score1: undefined,
    score2: undefined,
    projected: false,
    ...overrides,
  };
}

function rawMatch(overrides: Partial<Match> & Pick<Match, 'id' | 'team1' | 'team2'>): Match {
  const { id, team1, team2, ...rest } = overrides;
  return {
    id,
    round: rest.round ?? 'Group A',
    phase: rest.phase ?? 'group',
    date: rest.date ?? utcDate,
    utcDate: rest.utcDate ?? utcDate,
    team1,
    team2,
    venue: rest.venue ?? 'Test Venue',
    city: rest.city ?? 'Test City',
    tvChannels: rest.tvChannels ?? {},
    status: rest.status ?? 'upcoming',
    ...rest,
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

  it('treats a null winner as unresolved so future path still shows', () => {
    const matches: Match[] = [
      rawMatch({
        id: 'm81',
        num: 81,
        phase: 'knockout',
        round: 'Round of 32',
        team1: '1D',
        team2: '3B/E/F/I/J',
        status: 'upcoming',
      }),
      rawMatch({
        id: 'm82',
        num: 82,
        phase: 'knockout',
        round: 'Round of 32',
        team1: 'Belgium',
        team2: 'Senegal',
        status: 'upcoming',
        winner: null as unknown as 1 | 2,
      }),
      rawMatch({
        id: 'm93',
        num: 93,
        phase: 'knockout',
        round: 'Round of 16',
        team1: 'W83',
        team2: 'W84',
        status: 'upcoming',
      }),
      rawMatch({
        id: 'm94',
        num: 94,
        phase: 'knockout',
        round: 'Round of 16',
        team1: 'W81',
        team2: 'W82',
        status: 'upcoming',
      }),
      rawMatch({
        id: 'm98',
        num: 98,
        phase: 'knockout',
        round: 'Quarter-final',
        team1: 'W93',
        team2: 'W94',
        status: 'upcoming',
      }),
    ];

    const rounds = buildBracket(matches, [
      rawMatch({ id: 'm81', num: 81, phase: 'knockout', round: 'Round of 32', team1: '1D', team2: '3B/E/F/I/J', status: 'upcoming' }),
      rawMatch({ id: 'm82', num: 82, phase: 'knockout', round: 'Round of 32', team1: '1G', team2: '3A/E/H/I/J', status: 'upcoming' }),
      rawMatch({ id: 'm93', num: 93, phase: 'knockout', round: 'Round of 16', team1: 'W83', team2: 'W84', status: 'upcoming' }),
      rawMatch({ id: 'm94', num: 94, phase: 'knockout', round: 'Round of 16', team1: 'W81', team2: 'W82', status: 'upcoming' }),
      rawMatch({ id: 'm98', num: 98, phase: 'knockout', round: 'Quarter-final', team1: 'W93', team2: 'W94', status: 'upcoming' }),
    ]);
    expect(rounds[0]?.matches[1]?.winner).toBeUndefined();
    const steps = buildPathSteps(rounds, { matchId: 'm82', side: 1 });

    expect(steps.map((step) => step.match.matchId)).toEqual(['m82', 'm94', 'm98']);
    expect(steps.map((step) => step.focusSide)).toEqual([1, 2, 2]);
  });
});
