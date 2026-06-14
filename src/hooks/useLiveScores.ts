import { useState, useEffect, useCallback, useRef } from 'react';
import { normTeam } from '../data/teamMatch';

// Poll intervals: faster while a match is live (goals show fast), slower when
// there's no live action to be polite to the cache/VM.
const POLL_ACTIVE = 25_000;    // 25 s — a match is in progress (goals show fast)
const POLL_IDLE   = 5 * 60_000; // 5 min — no live action

export interface LiveScore {
  matchId: string;
  aflFixtureId?: number; // API-Football fixture id (lineups/stats fallback)
  espnEventId?: string;  // ESPN event id (primary for lineups/stats)
  score1?: number;
  score2?: number;
  status: 'upcoming' | 'live' | 'ht' | 'ft';
  minute?: number;
  minuteAt?: number; // epoch ms when `minute` was captured (for client-side ticking)
}

// ---------------------------------------------------------------------------
// Live scores come from /api/scores, which proxies (and edge-caches ~20s) the
// VM poller's scores.json — it makes no upstream feed calls of its own. The VM
// poller (scripts/vm-poller.mjs) resolves each match via ESPN (primary) →
// football-data.org → API-Football, so `status` already carries the
// feed-authoritative state (incl. PAUSED = half-time) by the time we read it.
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
  minuteAt?: string; // ISO — when `minute` last changed (anchor for client clock)
  aflFixtureId?: number;
  espnEventId?: string;
  score: {
    fullTime: FDScore;
    halfTime?: FDScore;
  };
  homeTeam: { name: string };
  awayTeam: { name: string };
}

// Shape written by the VM poller (scripts/vm-poller.mjs → scores.json).
interface WCScoresResponse {
  fetchedAt: string;
  updatedAt?: string; // when the poller captured this data (minute anchor)
  live: boolean;
  matches: FDMatch[];
  standings: unknown[];
}

// Map the poller's feed-authoritative status to the card state. Half-time is the
// poller's PAUSED (ESPN STATUS_HALFTIME / football-data PAUSED / API-Football HT),
// not something we re-guess from the minute — a genuine early second half (46–50')
// would otherwise be mislabelled "HT".
export function mapStatus(fdStatus: FDMatchStatus): LiveScore['status'] {
  if (fdStatus === 'IN_PLAY')  return 'live';
  if (fdStatus === 'PAUSED')   return 'ht';
  if (fdStatus === 'FINISHED') return 'ft';
  return 'upcoming';
}

// Build a normalised key from a team name so we can fuzzy-match FD results
// against our static fixture data (which may use slightly different spellings).
// Different feeds spell national teams differently (Czechia vs Czech Republic,
// etc.) — fold the variants to one token so score merges don't silently miss.
// Team-name matching (with feed aliases) lives in teamMatch.ts (test-guarded).

async function fetchFromFootballData(
  local: Array<{ id: string; team1: string; team2: string }>
): Promise<Map<string, LiveScore>> {
  const next = new Map<string, LiveScore>();

  const res = await fetch(WC_SCORES_URL);

  if (!res.ok) return next;

  const data: WCScoresResponse = await res.json();
  const fdMatches: FDMatch[] = data.matches ?? [];
  // Fallback anchor (whole-blob capture time) when a match has no per-minute stamp.
  const blobAt = data.updatedAt ? Date.parse(data.updatedAt) : Date.now();

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
      aflFixtureId: fdm.aflFixtureId,
      espnEventId: fdm.espnEventId,
      score1: fdm.score.fullTime.home ?? undefined,
      score2: fdm.score.fullTime.away ?? undefined,
      status: mapStatus(fdm.status),
      minute: fdm.minute ?? undefined,
      minuteAt: fdm.minuteAt ? Date.parse(fdm.minuteAt) : blobAt,
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
