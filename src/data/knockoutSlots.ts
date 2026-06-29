import { computeStandings } from './standings.js';
import { getThirdPlaceAssignment, isThirdPlaceAssignmentStable } from './thirdPlaceAllocation.js';
import type { Match } from '../types/index.js';

export type SlotStatus = 'placeholder' | 'projected' | 'final';

export interface ResolvedSlot {
  label: string;
  status: SlotStatus;
}

export interface ResolvedPair {
  team1: ResolvedSlot;
  team2: ResolvedSlot;
}

interface ThirdPlaceRow {
  group: string;
  team: string;
  points: number;
  gd: number;
  gf: number;
}

export function isGroupSlot(slot: string): boolean {
  return /^[12][A-L]$/.test(slot);
}

export function isThirdPlaceSlot(slot: string): boolean {
  return /^3[A-L](?:\/[A-L])+$/.test(slot);
}

export function isPlaceholderSlot(slot: string): boolean {
  return /^[WL]\d+$/.test(slot) || isGroupSlot(slot) || isThirdPlaceSlot(slot);
}

export function isProjectedPair(pair: ResolvedPair): boolean {
  return pair.team1.status === 'projected' || pair.team2.status === 'projected';
}

export function buildGroupSlotResolver(groupMatches: Match[]): (slot: string, opponentSlot?: string) => ResolvedSlot {
  const byGroup = new Map<string, Match[]>();
  for (const match of groupMatches) {
    if (!match.group) continue;
    const letter = match.group.replace(/^Group\s+/i, '').trim();
    if (!byGroup.has(letter)) byGroup.set(letter, []);
    byGroup.get(letter)!.push(match);
  }

  const groupResult = new Map<string, string[]>();
  const groupComplete = new Map<string, boolean>();
  const thirdPlaceRows: ThirdPlaceRow[] = [];
  for (const [group, matches] of byGroup) {
    const standings = computeStandings(matches);
    groupComplete.set(group, matches.length >= 6 && matches.every((m) => m.status === 'ft'));
    groupResult.set(group, [standings[0]?.team, standings[1]?.team, standings[2]?.team].filter(Boolean) as string[]);
    const third = standings[2];
    if (third) {
      thirdPlaceRows.push({
        group,
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
  const thirdPlaceAssignment = getThirdPlaceAssignment(advancingThirds.map((third) => third.group));
  const allGroupsComplete = [...groupComplete.values()].length > 0 && [...groupComplete.values()].every(Boolean);

  return (slot: string, opponentSlot?: string): ResolvedSlot => {
    const groupSlot = slot.match(/^([12])([A-L])$/);
    if (groupSlot) {
      const [, position, group] = groupSlot;
      const label = groupResult.get(group)?.[Number(position) - 1];
      if (!label) return { label: slot, status: 'placeholder' };
      return { label, status: groupComplete.get(group) ? 'final' : 'projected' };
    }

    const thirdPlaceSlot = slot.match(/^3([A-L](?:\/[A-L])+)$/);
    if (thirdPlaceSlot && opponentSlot && thirdPlaceAssignment) {
      const assignedSlot = thirdPlaceAssignment[opponentSlot];
      const allowedGroups = new Set(thirdPlaceSlot[1].split('/'));
      if (assignedSlot && allowedGroups.has(assignedSlot.slice(1))) {
        const label = thirdPlaceTeamBySlot.get(assignedSlot);
        if (label) {
          const assignedGroup = assignedSlot.slice(1);
          const final = allGroupsComplete || (groupComplete.get(assignedGroup) && isThirdPlaceAssignmentStable(opponentSlot, assignedSlot));
          return { label, status: final ? 'final' : 'projected' };
        }
      }
    }

    return { label: slot, status: 'placeholder' };
  };
}

export function resolveGroupBackedPair(
  slot1: string,
  slot2: string,
  resolveSlot: (slot: string, opponentSlot?: string) => ResolvedSlot,
): ResolvedPair {
  return {
    team1: resolveSlot(slot1, slot2),
    team2: resolveSlot(slot2, slot1),
  };
}
