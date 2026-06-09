import { useState, useEffect } from 'react';
import aflFixtureMap from '../data/aflFixtureMap.json';
import aflTeamIds from '../data/aflTeamIds.json';

// ---------------------------------------------------------------------------
// useMatchDetail
//
// Fetches lineup and statistics for a completed or in-progress match.
//
// Priority:
//   1. API-Football (/api/afl/fixtures/lineups and /api/afl/fixtures/statistics)
//      when an AFL fixture ID is known for the match.
//   2. football-data.org (/api/match/[fdMatchId]) as fallback.
//
// Results are cached in localStorage under the key "match-detail-{matchId}"
// indefinitely for finished matches (their lineups never change).
// ---------------------------------------------------------------------------

export interface PlayerEntry {
  id: number;
  name: string;
  number: number;
  pos: string;
}

export interface TeamLineup {
  team: string;
  formation: string;
  startXI: PlayerEntry[];
  bench: PlayerEntry[];
}

export interface MatchStat {
  type: string;
  home: string | number | null;
  away: string | number | null;
}

export interface MatchDetailData {
  home: TeamLineup;
  away: TeamLineup;
  stats: MatchStat[];
  source: 'afl' | 'fd';
}

// Strip metadata keys from the JSON maps so TypeScript won't complain.
const fixtureMap = aflFixtureMap as unknown as Record<string, number>;
const teamIds = aflTeamIds as unknown as Record<string, number>;

// ---------------------------------------------------------------------------
// AFL response mappers
// ---------------------------------------------------------------------------

function mapAflLineup(raw: {
  team?: { name?: string };
  formation?: string;
  startXI?: Array<{ player: { id: number; name: string; number: number; pos: string } }>;
  substitutes?: Array<{ player: { id: number; name: string; number: number; pos: string } }>;
}): TeamLineup {
  return {
    team: raw.team?.name ?? '',
    formation: raw.formation ?? '',
    startXI: (raw.startXI ?? []).map((e) => ({
      id: e.player.id,
      name: e.player.name,
      number: e.player.number,
      pos: e.player.pos,
    })),
    bench: (raw.substitutes ?? []).map((e) => ({
      id: e.player.id,
      name: e.player.name,
      number: e.player.number,
      pos: e.player.pos,
    })),
  };
}

function mapAflStats(
  homeStats: Array<{ type: string; value: string | number | null }>,
  awayStats: Array<{ type: string; value: string | number | null }>
): MatchStat[] {
  return homeStats.map((s, i) => ({
    type: s.type,
    home: s.value,
    away: awayStats[i]?.value ?? null,
  }));
}

// ---------------------------------------------------------------------------
// football-data.org response mapper
// ---------------------------------------------------------------------------

interface FDPlayer {
  name: string;
  shirtNumber?: number;
  position?: string;
}

function mapFdLineup(
  fdTeam: { name: string; formation?: string; startXI?: FDPlayer[]; bench?: FDPlayer[] } | undefined,
  teamName: string
): TeamLineup {
  if (!fdTeam) {
    return { team: teamName, formation: '', startXI: [], bench: [] };
  }
  return {
    team: fdTeam.name,
    formation: fdTeam.formation ?? '',
    startXI: (fdTeam.startXI ?? []).map((p, i) => ({
      id: i,
      name: p.name,
      number: p.shirtNumber ?? 0,
      pos: (p.position ?? '').slice(0, 1).toUpperCase(),
    })),
    bench: (fdTeam.bench ?? []).map((p, i) => ({
      id: i + 100,
      name: p.name,
      number: p.shirtNumber ?? 0,
      pos: (p.position ?? '').slice(0, 1).toUpperCase(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchFromAfl(aflFixtureId: number): Promise<MatchDetailData | null> {
  const [lineupsRes, statsRes] = await Promise.all([
    fetch(`/api/afl/fixtures/lineups?fixture=${aflFixtureId}`),
    fetch(`/api/afl/fixtures/statistics?fixture=${aflFixtureId}`),
  ]);

  if (!lineupsRes.ok || !statsRes.ok) return null;

  const lineupsData = await lineupsRes.json();
  const statsData = await statsRes.json();

  const lineups: unknown[] = lineupsData.response ?? [];
  const statsResp: unknown[] = statsData.response ?? [];

  if (lineups.length < 2) return null;

  const homeLineupRaw = lineups[0] as Parameters<typeof mapAflLineup>[0];
  const awayLineupRaw = lineups[1] as Parameters<typeof mapAflLineup>[0];

  const homeStats = ((statsResp[0] as { statistics?: Array<{ type: string; value: string | number | null }> })?.statistics ?? []);
  const awayStats = ((statsResp[1] as { statistics?: Array<{ type: string; value: string | number | null }> })?.statistics ?? []);

  return {
    home: mapAflLineup(homeLineupRaw),
    away: mapAflLineup(awayLineupRaw),
    stats: mapAflStats(homeStats, awayStats),
    source: 'afl',
  };
}

async function fetchFromFd(fdMatchId: number): Promise<MatchDetailData | null> {
  const res = await fetch(`/api/match/${fdMatchId}`);
  if (!res.ok) return null;

  const data = await res.json();
  const match = data;

  return {
    home: mapFdLineup(match.homeTeam, match.homeTeam?.name ?? ''),
    away: mapFdLineup(match.awayTeam, match.awayTeam?.name ?? ''),
    stats: [], // football-data.org free tier does not include statistics
    source: 'fd',
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseMatchDetailOptions {
  /** Internal match ID (e.g. "m12") */
  matchId: string;
  /** football-data.org integer match ID — available after live scores are fetched */
  fdMatchId?: number;
  /** Whether the match is finished (determines whether to cache permanently) */
  isFinished: boolean;
  /** Team names so we can look up AFL team IDs for H2H */
  team1?: string;
  team2?: string;
}

export interface UseMatchDetailResult {
  data: MatchDetailData | null;
  loading: boolean;
  error: string | null;
  /** API-Football team IDs for team1/team2 (for H2H queries) */
  aflTeam1Id: number | null;
  aflTeam2Id: number | null;
}

export function useMatchDetail({
  matchId,
  fdMatchId,
  isFinished,
  team1,
  team2,
}: UseMatchDetailOptions): UseMatchDetailResult {
  const [data, setData] = useState<MatchDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive AFL fixture and team IDs from the static maps.
  const aflFixtureId: number | undefined = fixtureMap[matchId];
  const aflTeam1Id: number | null = team1 ? (teamIds[team1] ?? null) : null;
  const aflTeam2Id: number | null = team2 ? (teamIds[team2] ?? null) : null;

  useEffect(() => {
    const cacheKey = `match-detail-${matchId}`;

    // Return cached data if available.
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached) as MatchDetailData);
        return;
      }
    } catch {
      // Ignore storage errors.
    }

    // Nothing to fetch if we have neither an AFL fixture ID nor an FD match ID.
    if (!aflFixtureId && !fdMatchId) return;

    setLoading(true);
    setError(null);

    async function load() {
      let result: MatchDetailData | null = null;

      // Try AFL first (preferred — richer data).
      if (aflFixtureId) {
        try {
          result = await fetchFromAfl(aflFixtureId);
        } catch {
          // Fall through to FD.
        }
      }

      // Fallback to football-data.org.
      if (!result && fdMatchId) {
        try {
          result = await fetchFromFd(fdMatchId);
        } catch {
          // Both sources failed.
        }
      }

      if (result) {
        // Cache permanently for finished matches; not at all for live/upcoming.
        if (isFinished) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(result));
          } catch {
            // Ignore quota errors.
          }
        }
        setData(result);
      } else {
        setError('Could not load match detail.');
      }

      setLoading(false);
    }

    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, aflFixtureId, fdMatchId, isFinished]);

  return { data, loading, error, aflTeam1Id, aflTeam2Id };
}

// ---------------------------------------------------------------------------
// Utility: exported for H2HPanel to use when it only has team names
// ---------------------------------------------------------------------------

export function getAflTeamId(teamName: string): number | null {
  return (teamIds as Record<string, number>)[teamName] ?? null;
}
