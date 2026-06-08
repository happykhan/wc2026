import { useState, useEffect, useCallback } from 'react';

const POLL_ACTIVE = 60_000;  // 60s during live matches

interface LiveScore {
  matchId: string;
  score1?: number;
  score2?: number;
  status: 'upcoming' | 'live' | 'ht' | 'ft';
  minute?: number;
}

export function useLiveScores(enabled: boolean) {
  const [scores] = useState<Map<string, LiveScore>>(new Map());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchScores = useCallback(async () => {
    if (!enabled) return;
    try {
      await fetch(
        'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
      );
      setLastFetch(new Date());
    } catch (_) {
      // Network failure is silent
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchScores();
    const interval = setInterval(fetchScores, POLL_ACTIVE);
    return () => clearInterval(interval);
  }, [enabled, fetchScores]);

  return { scores, lastFetch };
}
