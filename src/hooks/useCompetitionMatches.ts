import { useState, useEffect, useCallback, useRef } from 'react';
import type { Match, CompetitionCode } from '../types';

// ---------------------------------------------------------------------------
// football-data.org match shape (subset we care about)
// ---------------------------------------------------------------------------

type FDStatus =
  | 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED'
  | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED'
  | string;

interface FDTeam {
  id: number;
  name: string;
  shortName?: string;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: FDStatus;
  stage: string;
  group: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    fullTime: { home: number | null; away: number | null };
  };
  venue?: string;
  minute?: number | null;
}

// ---------------------------------------------------------------------------
// Normalise football-data.org status to our internal status
// ---------------------------------------------------------------------------

function mapStatus(fdStatus: FDStatus, minute?: number | null): Match['status'] {
  if (fdStatus === 'IN_PLAY') {
    return minute != null && minute >= 45 && minute <= 50 ? 'ht' : 'live';
  }
  if (fdStatus === 'PAUSED')   return 'ht';
  if (fdStatus === 'FINISHED') return 'ft';
  return 'upcoming';
}

// ---------------------------------------------------------------------------
// Humanise the stage name from football-data.org (e.g. "GROUP_STAGE" → "Group Stage")
// ---------------------------------------------------------------------------

function humaniseStage(stage: string): string {
  if (!stage) return '';
  // Convert SCREAMING_SNAKE_CASE to Title Case
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Convert a football-data.org match to our internal Match interface
// ---------------------------------------------------------------------------

let fdCounter = 1;

export function normaliseFDMatch(fdm: FDMatch): Match {
  const team1 = fdm.homeTeam.shortName || fdm.homeTeam.name;
  const team2 = fdm.awayTeam.shortName || fdm.awayTeam.name;
  const utcDate = new Date(fdm.utcDate);

  return {
    id:       `fd-${fdm.id || fdCounter++}`,
    round:    humaniseStage(fdm.stage),
    phase:    fdm.group ? 'group' : 'knockout',
    group:    fdm.group ?? undefined,
    date:     utcDate,
    utcDate,
    team1,
    team2,
    venue:    fdm.venue ?? '',
    city:     fdm.venue ?? '',
    tvChannels: {},  // No known broadcast info for club competitions
    score1:   fdm.score.fullTime.home ?? undefined,
    score2:   fdm.score.fullTime.away ?? undefined,
    status:   mapStatus(fdm.status, fdm.minute),
    minute:   fdm.minute ?? undefined,
    fdMatchId: fdm.id,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type CompetitionMatchesState = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseCompetitionMatchesResult {
  matches: Match[];
  state: CompetitionMatchesState;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 60_000;

export function useCompetitionMatches(
  code: CompetitionCode,
  spoilerMode: boolean,
): UseCompetitionMatchesResult {
  const [matches, setMatches] = useState<Match[]>([]);
  const [state, setState] = useState<CompetitionMatchesState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMatches = useCallback(async () => {
    setState((prev) => prev === 'idle' ? 'loading' : prev);
    try {
      const res = await fetch(`/api/competition/${code}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { matches?: FDMatch[] };
      const normalised = (data.matches ?? []).map(normaliseFDMatch);
      normalised.sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());
      setMatches(normalised);
      setState('loaded');
    } catch {
      setState('error');
    }
  }, [code]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // WC uses the static bundle + Cloudflare Worker; skip for WC.
    if (code === 'WC') {
      setMatches([]);
      setState('idle');
      return;
    }

    setState('loading');
    void fetchMatches();

    // Poll when spoilers are enabled so live scores refresh automatically.
    if (spoilerMode) {
      intervalRef.current = setInterval(() => void fetchMatches(), POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [code, spoilerMode, fetchMatches]);

  return { matches, state, refetch: fetchMatches };
}
