import type { Match } from '../types';
import { isKnockoutTeam } from './processFixtures';
import { buildGroupSlotResolver, isProjectedPair, resolveGroupBackedPair, type ResolvedSlot } from './knockoutSlots';

// ---------------------------------------------------------------------------
// Knockout bracket resolver
//
// Fixtures store knockout slots as placeholders:
//   "1A" / "2B"        → winner / runner-up of a group
//   "3A/B/C/D/F"       → one of the best third-placed teams, allocated by
//                        FIFA's third-place assignment table
//   "W74" / "L101"     → winner / loser of match #74 / #101
//
// buildBracket() walks the knockout matches in match-number order (which is
// also dependency order) and fills in real team names as group standings
// settle and knockout results come in. Anything still unknown keeps its
// placeholder label so the bracket reads as "fills in as teams advance".
// ---------------------------------------------------------------------------

export interface BracketTeam {
  /** Resolved team name, or the original placeholder if not yet known. */
  label: string;
  /** True once this slot maps to an actual or projected team. */
  resolved: boolean;
  /** True when the resolved label depends on current, not-final standings. */
  projected?: boolean;
}

export interface BracketMatch {
  matchId: string;
  num?: number;
  round: string;
  utcDate: Date;
  team1: BracketTeam;
  team2: BracketTeam;
  score1?: number;
  score2?: number;
  status: Match['status'];
  /** Which side won (1 or 2), when decided by a non-level full-time score. */
  winner?: 1 | 2;
  /** True when either displayed team is an as-it-stands projection. */
  projected?: boolean;
}

export interface BracketRound {
  key: string;
  title: string;
  matches: BracketMatch[];
}

export interface ResolvedKnockoutTeams {
  team1: string;
  team2: string;
  projected: boolean;
}

// Display order + titles for the knockout rounds, keyed by the round string
// used in fixtures.json.
const ROUND_ORDER: { round: string; key: string; title: string }[] = [
  { round: 'Round of 32',          key: 'r32',   title: 'Round of 32' },
  { round: 'Round of 16',          key: 'r16',   title: 'Round of 16' },
  { round: 'Quarter-final',        key: 'qf',    title: 'Quarter-finals' },
  { round: 'Semi-final',           key: 'sf',    title: 'Semi-finals' },
  { round: 'Match for third place', key: 'third', title: 'Third place' },
  { round: 'Final',                key: 'final', title: 'Final' },
];

export function buildBracket(allMatches: Match[]): BracketRound[] {
  const groupMatches = allMatches.filter((m) => m.phase === 'group' && m.group);
  const resolveGroupSlot = buildGroupSlotResolver(groupMatches);

  // 2. Walk knockout matches in num order, resolving each slot.
  const knockout = allMatches
    .filter((m) => m.phase === 'knockout')
    .sort((a, b) => (a.num ?? 0) - (b.num ?? 0));

  // resolved[num] → the BracketMatch, so later W{num}/L{num} can look it up.
  const resolved = new Map<number, BracketMatch>();
  const isResultSlot = (code: string) => /^([WL])(\d+)$/.test(code);

  const toBracketTeam = (slot: ResolvedSlot): BracketTeam => ({
    label: slot.label,
    resolved: slot.status !== 'placeholder',
    projected: slot.status === 'projected',
  });

  const resolveTeam = (code: string): BracketTeam => {
    if (!isKnockoutTeam(code)) return { label: code, resolved: true };

    // Winner / loser of a previous match.
    const wl = code.match(/^([WL])(\d+)$/);
    if (wl) {
      const [, kind, numStr] = wl;
      const ref = resolved.get(Number(numStr));
      if (ref && ref.winner) {
        const winSide = ref.winner;
        const loseSide = winSide === 1 ? 2 : 1;
        const pick = kind === 'W' ? winSide : loseSide;
        const team = pick === 1 ? ref.team1 : ref.team2;
        if (team.resolved) return { label: team.label, resolved: true };
      }
      return { label: code, resolved: false };
    }

    return toBracketTeam(resolveGroupSlot(code));
  };

  for (const m of knockout) {
    const pair = resolveGroupBackedPair(m.team1, m.team2, resolveGroupSlot);
    const team1 = isKnockoutTeam(m.team1) && !isResultSlot(m.team1)
      ? toBracketTeam(pair.team1)
      : resolveTeam(m.team1);
    const team2 = isKnockoutTeam(m.team2) && !isResultSlot(m.team2)
      ? toBracketTeam(pair.team2)
      : resolveTeam(m.team2);
    let winner: 1 | 2 | undefined;
    if (
      m.status === 'ft' &&
      m.score1 !== undefined &&
      m.score2 !== undefined &&
      m.score1 !== m.score2
    ) {
      winner = m.score1 > m.score2 ? 1 : 2;
    }
    const bm: BracketMatch = {
      matchId: m.id,
      num: m.num,
      round: m.round,
      utcDate: m.utcDate,
      team1,
      team2,
      score1: m.score1,
      score2: m.score2,
      status: m.status,
      winner,
      projected: Boolean(isProjectedPair(pair) || team1.projected || team2.projected || m.projectedKnockoutTeams),
    };
    if (m.num !== undefined) resolved.set(m.num, bm);
  }

  // 3. Bucket into ordered rounds.
  const rounds: BracketRound[] = [];
  for (const def of ROUND_ORDER) {
    const matches = knockout
      .filter((m) => m.round === def.round)
      .map((m) => resolved.get(m.num ?? -1))
      .filter((bm): bm is BracketMatch => bm !== undefined);
    // Matches with no num (third place / final) won't be in `resolved` — rebuild.
    if (matches.length === 0) {
      const fallback = knockout.filter((m) => m.round === def.round);
      for (const m of fallback) {
        const pair = resolveGroupBackedPair(m.team1, m.team2, resolveGroupSlot);
        const team1 = isResultSlot(m.team1) ? resolveTeam(m.team1) : toBracketTeam(pair.team1);
        const team2 = isResultSlot(m.team2) ? resolveTeam(m.team2) : toBracketTeam(pair.team2);
        matches.push({
          matchId: m.id,
          num: m.num,
          round: m.round,
          utcDate: m.utcDate,
          team1,
          team2,
          score1: m.score1,
          score2: m.score2,
          status: m.status,
          winner: undefined,
          projected: Boolean(isProjectedPair(pair) || team1.projected || team2.projected || m.projectedKnockoutTeams),
        });
      }
    }
    if (matches.length > 0) rounds.push({ key: def.key, title: def.title, matches });
  }

  return rounds;
}

export function resolveKnockoutMatchTeams(allMatches: Match[]): Map<string, ResolvedKnockoutTeams> {
  const resolved = new Map<string, ResolvedKnockoutTeams>();

  for (const round of buildBracket(allMatches)) {
    for (const match of round.matches) {
      resolved.set(match.matchId, {
        team1: match.team1.label,
        team2: match.team2.label,
        projected: Boolean(match.projected),
      });
    }
  }

  return resolved;
}
