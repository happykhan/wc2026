import { useState, useEffect, useCallback, useRef } from 'react';

// Poll intervals: faster when spoilers are on (user wants live info),
// slower otherwise to be polite to the API.
const POLL_ACTIVE = 60_000;    // 60 s — matches in progress or spoilers enabled
const POLL_IDLE   = 5 * 60_000; // 5 min — spoilers off / no live action

export interface LiveScore {
  matchId: string;
  fdMatchId?: number;   // football-data.org integer match ID (for detail lookups)
  score1?: number;
  score2?: number;
  status: 'upcoming' | 'live' | 'ht' | 'ft';
  minute?: number;
}

// ---------------------------------------------------------------------------
// Live scores come from our own /api/scores Vercel function, which calls
// football-data.org directly and is edge-cached so the upstream stays within
// the free 10-requests/minute limit. This replaced a Cloudflare Worker + KV +
// poller daemon (see api/scores.ts).
// Docs: https://www.football-data.org/documentation/quickstart
// ---------------------------------------------------------------------------

const WC_SCORES_URL = '/api/scores';

type FDMatchStatus =
  | 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED'
  | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED'
  | string;

interface FDScore {
  home: number | null;
  away: number | null;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: FDMatchStatus;
  minute?: number | null;
  score: {
    fullTime: FDScore;
    halfTime?: FDScore;
  };
  homeTeam: { name: string };
  awayTeam: { name: string };
}

// Shape written by wc_scores_poller.py
interface WCScoresResponse {
  fetchedAt: string;
  live: boolean;
  matches: FDMatch[];
  standings: unknown[];
}

function mapStatus(fdStatus: FDMatchStatus, minute?: number | null): LiveScore['status'] {
  if (fdStatus === 'IN_PLAY') {
    // Treat the pause around 45 min as half-time
    return minute !== undefined && minute !== null && minute >= 45 && minute <= 50 ? 'ht' : 'live';
  }
  if (fdStatus === 'PAUSED')   return 'ht';
  if (fdStatus === 'FINISHED') return 'ft';
  return 'upcoming';
}

// Build a normalised key from a team name so we can fuzzy-match FD results
// against our static fixture data (which may use slightly different spellings).
function normTeam(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

async function fetchFromFootballData(
  local: Array<{ id: string; team1: string; team2: string }>
): Promise<Map<string, LiveScore>> {
  const next = new Map<string, LiveScore>();

  const res = await fetch(WC_SCORES_URL);

  if (!res.ok) return next;

  const data: WCScoresResponse = await res.json();
  const fdMatches: FDMatch[] = data.matches ?? [];

  for (const fdm of fdMatches) {
    const fdHome = normTeam(fdm.homeTeam?.name);
    const fdAway = normTeam(fdm.awayTeam?.name);
    // Knockout fixtures arrive with null team names (TBD) — skip them so one
    // null doesn't abort the whole mapping and wipe out the live scores.
    if (!fdHome || !fdAway) continue;

    // Match FD results back to our internal IDs via team-name fuzzy match.
    const match = local.find(
      (m) => normTeam(m.team1) === fdHome && normTeam(m.team2) === fdAway
    );
    if (!match) continue;

    next.set(match.id, {
      matchId: match.id,
      fdMatchId: fdm.id,
      score1: fdm.score.fullTime.home ?? undefined,
      score2: fdm.score.fullTime.away ?? undefined,
      status: mapStatus(fdm.status, fdm.minute),
      minute: fdm.minute ?? undefined,
    });
  }

  return next;
}

// ---------------------------------------------------------------------------

type MatchRef = Array<{ id: string; team1: string; team2: string }>;

export function useLiveScores(enabled: boolean, matchList?: MatchRef) {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Keep a stable ref to the match list so the fetch callback doesn't need it
  // as a dependency (avoids re-creating the interval on every render).
  const matchListRef = useRef<MatchRef>([]);

  // Synchronise the ref outside of render via an effect.
  useEffect(() => {
    matchListRef.current = matchList ?? [];
  }, [matchList]);

  const fetchScores = useCallback(async () => {
    const next = await fetchFromFootballData(matchListRef.current).catch(() => new Map<string, LiveScore>());

    if (next.size > 0) {
      setScores((prev) => {
        // Merge: keep previously seen FT results for matches that have since
        // dropped out of the API response.
        const merged = new Map(prev);
        for (const [id, score] of next) {
          merged.set(id, score);
        }
        return merged;
      });
    }

    setLastFetch(new Date());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch — called as a fire-and-forget side effect so we never call
    // setState synchronously inside the effect body.
    void fetchScores();

    const interval = setInterval(
      () => void fetchScores(),
      enabled ? POLL_ACTIVE : POLL_IDLE
    );
    return () => clearInterval(interval);
  }, [enabled, fetchScores]);

  return { scores, lastFetch };
}
