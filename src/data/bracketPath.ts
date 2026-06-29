import type { BracketMatch, BracketRound } from './bracket';

export interface PathSelection {
  matchId: string;
  side: 1 | 2;
}

export interface PathStep {
  match: BracketMatch;
  focusSide: 1 | 2;
}

function winnerSlot(num?: number) {
  return num !== undefined ? `W${num}` : null;
}

function sourceFor(match: BracketMatch, side: 1 | 2) {
  return side === 1 ? match.sourceTeam1 : match.sourceTeam2;
}

function labelFor(match: BracketMatch, side: 1 | 2) {
  return side === 1 ? match.team1.label : match.team2.label;
}

function isEliminated(match: BracketMatch, side: 1 | 2) {
  return match.winner !== undefined && match.winner !== side;
}

function findPreviousStep(matches: BracketMatch[], step: PathStep): PathStep | null {
  const source = sourceFor(step.match, step.focusSide);
  const wl = source.match(/^([WL])(\d+)$/);
  if (!wl) return null;

  const [, kind, numStr] = wl;
  const previous = matches.find((candidate) => candidate.num === Number(numStr));
  if (!previous) return null;

  const currentLabel = labelFor(step.match, step.focusSide);
  const sideByLabel =
    previous.team1.label === currentLabel ? 1 :
    previous.team2.label === currentLabel ? 2 :
    null;

  if (kind === 'W') {
    if (previous.winner) return { match: previous, focusSide: previous.winner };
    if (sideByLabel) return { match: previous, focusSide: sideByLabel };
    return null;
  }

  if (previous.winner) {
    return { match: previous, focusSide: previous.winner === 1 ? 2 : 1 };
  }
  if (sideByLabel) return { match: previous, focusSide: sideByLabel };
  return null;
}

function findNextStep(matches: BracketMatch[], step: PathStep): PathStep | null {
  if (isEliminated(step.match, step.focusSide)) return null;

  const slot = winnerSlot(step.match.num);
  if (!slot) return null;

  const next = matches.find((candidate) =>
    candidate.sourceTeam1 === slot || candidate.sourceTeam2 === slot
  );
  if (!next) return null;

  return {
    match: next,
    focusSide: next.sourceTeam1 === slot ? 1 : 2,
  };
}

export function buildPathSteps(rounds: BracketRound[], selection: PathSelection | null): PathStep[] {
  if (!selection) return [];

  const allMatches = rounds.flatMap((round) => round.matches);
  const start = allMatches.find((match) => match.matchId === selection.matchId);
  if (!start) return [];

  let first: PathStep = { match: start, focusSide: selection.side };
  let guard = 0;
  while (guard < 8) {
    const previous = findPreviousStep(allMatches, first);
    if (!previous) break;
    first = previous;
    guard += 1;
  }

  const steps: PathStep[] = [first];
  let current = first;
  guard = 0;
  while (guard < 8) {
    const next = findNextStep(allMatches, current);
    if (!next) break;
    steps.push(next);
    current = next;
    guard += 1;
  }

  return steps;
}
