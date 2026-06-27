import type { Match } from '../types';
import { computeStandings } from './standings';
import { isKnockoutTeam } from './processFixtures';
import { THIRD_PLACE_ASSIGNMENTS } from './thirdPlaceAllocation';

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
  /** True once this slot maps to an actual qualified team. */
  resolved: boolean;
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
}

export interface BracketRound {
  key: string;
  title: string;
  matches: BracketMatch[];
}

export interface ResolvedKnockoutTeams {
  team1: string;
  team2: string;
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
  // 1. Resolve group positions from current standings. During the last group
  //    matches this is deliberately "as it stands"; completed groups naturally
  //    become final.
  const groupMatches = allMatches.filter((m) => m.phase === 'group' && m.group);
  const byGroup = new Map<string, Match[]>();
  for (const m of groupMatches) {
    const g = m.group!;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  }

  // group letter (e.g. "A") → [winnerName, runnerUpName, thirdName].
  const groupResult = new Map<string, string[]>();
  const thirdPlaceRows: Array<{ group: string; team: string; points: number; gd: number; gf: number }> = [];
  for (const [group, ms] of byGroup) {
    const standings = computeStandings(ms);
    const letter = group.replace(/^Group\s+/i, '').trim();
    groupResult.set(letter, [standings[0]?.team, standings[1]?.team, standings[2]?.team].filter(Boolean) as string[]);
    const third = standings[2];
    if (third) {
      thirdPlaceRows.push({
        group: letter,
        team: third.team,
        points: third.points,
        gd: third.gd,
        gf: third.gf,
      });
    }
  }
  const advancingThirds = thirdPlaceRows
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .slice(0, 8);
  const thirdPlaceTeamBySlot = new Map(advancingThirds.map((third) => [`3${third.group}`, third.team]));
  const thirdPlaceKey = advancingThirds.map((third) => third.group).sort().join('');
  const thirdPlaceAssignment = THIRD_PLACE_ASSIGNMENTS[thirdPlaceKey];

  // 2. Walk knockout matches in num order, resolving each slot.
  const knockout = allMatches
    .filter((m) => m.phase === 'knockout')
    .sort((a, b) => (a.num ?? 0) - (b.num ?? 0));

  // resolved[num] → the BracketMatch, so later W{num}/L{num} can look it up.
  const resolved = new Map<number, BracketMatch>();

  const resolveTeam = (code: string, opponentCode?: string): BracketTeam => {
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

    // Winner (1) / runner-up (2) of a group.
    const gp = code.match(/^([12])([A-L])$/);
    if (gp) {
      const [, posStr, letter] = gp;
      const teams = groupResult.get(letter);
      const name = teams?.[Number(posStr) - 1];
      if (name) return { label: name, resolved: true };
      return { label: code, resolved: false };
    }

    const thirdPlace = code.match(/^3([A-L](?:\/[A-L])+)$/);
    if (thirdPlace && opponentCode && thirdPlaceAssignment) {
      const assignedSlot = thirdPlaceAssignment[opponentCode];
      const allowedGroups = new Set(thirdPlace[1].split('/'));
      if (assignedSlot && allowedGroups.has(assignedSlot.slice(1))) {
        const name = thirdPlaceTeamBySlot.get(assignedSlot);
        if (name) return { label: name, resolved: true };
      }
    }

    return { label: code, resolved: false };
  };

  for (const m of knockout) {
    const team1 = resolveTeam(m.team1);
    const team2 = resolveTeam(m.team2, m.team1);
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
        matches.push({
          matchId: m.id,
          num: m.num,
          round: m.round,
          utcDate: m.utcDate,
          team1: resolveTeam(m.team1),
          team2: resolveTeam(m.team2, m.team1),
          score1: m.score1,
          score2: m.score2,
          status: m.status,
          winner: undefined,
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
      });
    }
  }

  return resolved;
}
