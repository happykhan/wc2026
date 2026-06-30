import { describe, expect, it } from 'vitest';
import { espnEventsFromSummary } from './matchdetail.js';

describe('espnEventsFromSummary', () => {
  it('keeps standard key events', () => {
    const events = espnEventsFromSummary({
      keyEvents: [
        {
          clock: { displayValue: "63'" },
          type: { text: 'Goal' },
          team: { displayName: 'Germany' },
          athletesInvolved: [{ displayName: 'Jamal Musiala' }],
          text: 'Goal! Germany 1, Paraguay 0. Jamal Musiala (Germany).',
        },
      ],
    });

    expect(events).toEqual([
      {
        minute: "63'",
        kind: 'goal',
        team: 'Germany',
        player: 'Jamal Musiala',
        detail: 'Goal',
      },
    ]);
  });

  it('adds explicit penalty shootout timeline events from ESPN plays', () => {
    const events = espnEventsFromSummary({
      plays: [
        {
          text: 'Penalty Shootout begins Germany 1, Paraguay 1.',
          period: { number: 5 },
        },
        {
          text: 'Penalty saved. Kai Havertz (Germany) left footed shot saved.',
          type: { text: 'Penalty - Saved', type: 'penalty---saved' },
          team: { displayName: 'Germany' },
          period: { number: 5 },
        },
        {
          text: 'Goal! Germany 1, Paraguay 1(1). Mauricio (Paraguay) converts the penalty.',
          type: { text: 'Penalty - Scored', type: 'penalty---scored' },
          team: { displayName: 'Paraguay' },
          period: { number: 5 },
        },
        {
          text: 'Penalty missed. Antonio Sanabria (Paraguay) right footed shot is close, but misses to the left.',
          type: { text: 'Penalty - Missed', type: 'penalty---missed' },
          team: { displayName: 'Paraguay' },
          period: { number: 5 },
        },
        {
          text: 'Penalty Shootout ends, Germany 1(3), Paraguay 1(4).',
          period: { number: 5 },
        },
      ],
    });

    expect(events).toEqual([
      {
        minute: 'PSO',
        kind: 'pens-start',
        team: '',
        player: '',
        detail: 'Penalty Shootout begins Germany 1, Paraguay 1.',
      },
      {
        minute: 'P1',
        kind: 'pens-save',
        team: 'Germany',
        player: 'Kai Havertz',
        detail: 'Penalty saved. Kai Havertz (Germany) left footed shot saved.',
      },
      {
        minute: 'P2',
        kind: 'pens-score',
        team: 'Paraguay',
        player: 'Mauricio',
        detail: 'Goal! Germany 1, Paraguay 1(1). Mauricio (Paraguay) converts the penalty.',
      },
      {
        minute: 'P3',
        kind: 'pens-miss',
        team: 'Paraguay',
        player: 'Antonio Sanabria',
        detail: 'Penalty missed. Antonio Sanabria (Paraguay) right footed shot is close, but misses to the left.',
      },
      {
        minute: 'PSO',
        kind: 'pens-end',
        team: '',
        player: '',
        detail: 'Penalty Shootout ends, Germany 1(3), Paraguay 1(4).',
      },
    ]);
  });

  it('does not treat normal-time penalty goals as shootout events', () => {
    const events = espnEventsFromSummary({
      keyEvents: [
        {
          clock: { displayValue: "12'" },
          type: { text: 'Penalty Scored' },
          team: { displayName: 'Brazil' },
          text: 'Goal! Brazil 1, Japan 0. Neymar (Brazil) converts the penalty.',
        },
      ],
      plays: [
        {
          text: 'Goal! Brazil 1, Japan 0. Neymar (Brazil) converts the penalty.',
          type: { text: 'Penalty - Scored', type: 'penalty---scored' },
          team: { displayName: 'Brazil' },
          period: { number: 1 },
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      minute: "12'",
      kind: 'pen',
      team: 'Brazil',
    });
  });

  it('synthesizes shootout timeline events from ESPN shootout arrays when plays are absent', () => {
    const events = espnEventsFromSummary({
      shootout: [
        {
          team: 'Germany',
          shots: [
            { player: 'Kai Havertz', shotNumber: 1, didScore: false },
            { player: 'Joshua Kimmich', shotNumber: 2, didScore: true },
          ],
        },
        {
          team: 'Paraguay',
          shots: [
            { player: 'Mauricio', shotNumber: 1, didScore: true },
            { player: 'Gustavo Gomez', shotNumber: 2, didScore: true },
          ],
        },
      ],
    });

    expect(events).toEqual([
      { minute: 'PSO', kind: 'pens-start', team: '', player: '', detail: 'Penalty shootout begins.' },
      { minute: 'P1', kind: 'pens-miss', team: 'Germany', player: 'Kai Havertz', detail: 'Penalty missed.' },
      { minute: 'P2', kind: 'pens-score', team: 'Paraguay', player: 'Mauricio', detail: 'Penalty scored.' },
      { minute: 'P3', kind: 'pens-score', team: 'Germany', player: 'Joshua Kimmich', detail: 'Penalty scored.' },
      { minute: 'P4', kind: 'pens-score', team: 'Paraguay', player: 'Gustavo Gomez', detail: 'Penalty scored.' },
      { minute: 'PSO', kind: 'pens-end', team: '', player: '', detail: 'Penalty shootout ends.' },
    ]);
  });
});
