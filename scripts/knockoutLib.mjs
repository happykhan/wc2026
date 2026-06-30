export function isKnockoutSlot(name) {
  return /^[WL]\d+$/.test(name) || /^[123][A-L](?:\/[A-L])+?$/.test(name) || /^[12][A-L]$/.test(name);
}

function scoreOf(match) {
  return match?.score?.fullTime ?? {};
}

function isFinished(match) {
  const score = scoreOf(match);
  return match?.status === 'FINISHED' && score.home != null && score.away != null;
}

function winnerOf(match) {
  if (match?.winner === 1 || match?.winner === 2) return match.winner;
  if (!isFinished(match)) return null;
  const score = scoreOf(match);
  if (score.home === score.away) return null;
  return score.home > score.away ? 1 : 2;
}

function knockoutNum(match) {
  if (typeof match?.num === 'number') return match.num;
  const id = typeof match?.id === 'string' ? match.id.match(/^m(\d+)$/) : null;
  return id ? Number(id[1]) : null;
}

function computeGroupResult(matches) {
  const byGroup = new Map();
  for (const match of matches) {
    if (!match?.group) continue;
    if (!byGroup.has(match.group)) byGroup.set(match.group, []);
    byGroup.get(match.group).push(match);
  }

  const result = new Map();
  for (const [group, groupMatches] of byGroup) {
    if (groupMatches.length === 0 || !groupMatches.every(isFinished)) continue;
    const standings = new Map();
    for (const match of groupMatches) {
      const teams = [match.homeTeam?.name, match.awayTeam?.name];
      for (const team of teams) {
        if (!team) continue;
        if (!standings.has(team)) {
          standings.set(team, { team, points: 0, gd: 0, gf: 0 });
        }
      }
      const home = standings.get(match.homeTeam?.name);
      const away = standings.get(match.awayTeam?.name);
      const score = scoreOf(match);
      home.gf += score.home;
      away.gf += score.away;
      home.gd += score.home - score.away;
      away.gd += score.away - score.home;
      if (score.home > score.away) home.points += 3;
      else if (score.home < score.away) away.points += 3;
      else {
        home.points += 1;
        away.points += 1;
      }
    }
    const ordered = [...standings.values()].sort(
      (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
    );
    const letter = String(group).replace(/^Group\s+/i, '').trim();
    result.set(letter, ordered.slice(0, 2).map((row) => row.team));
  }
  return result;
}

function resolveSlot(code, groupResult, priorByNum) {
  if (!isKnockoutSlot(code)) return code;

  const wl = code.match(/^([WL])(\d+)$/);
  if (wl) {
    const [, kind, rawNum] = wl;
    const prior = priorByNum.get(Number(rawNum));
    if (!prior?.winner) return code;
    const pick = kind === 'W' ? prior.winner : prior.winner === 1 ? 2 : 1;
    return pick === 1 ? prior.team1 : prior.team2;
  }

  const gp = code.match(/^([12])([A-L])$/);
  if (gp) {
    const [, pos, letter] = gp;
    const teams = groupResult.get(letter);
    return teams?.[Number(pos) - 1] ?? code;
  }

  return code;
}

export function resolveKnockoutTeams(matches, playedMatches = []) {
  const groupResult = computeGroupResult(playedMatches);
  const playedById = new Map(playedMatches.map((match) => [match.id, match]));
  const priorByNum = new Map();

  return matches.map((match) => {
    if (match.group) return match;

    const team1 = resolveSlot(match.homeTeam?.name, groupResult, priorByNum);
    const team2 = resolveSlot(match.awayTeam?.name, groupResult, priorByNum);
    const next = {
      ...match,
      homeTeam: { ...match.homeTeam, name: team1 },
      awayTeam: { ...match.awayTeam, name: team2 },
    };

    const num = knockoutNum(match);
    if (num != null) {
      const played = playedById.get(match.id);
      const winner = winnerOf(played);
      priorByNum.set(num, {
        team1,
        team2,
        winner,
      });
    }

    return next;
  });
}
