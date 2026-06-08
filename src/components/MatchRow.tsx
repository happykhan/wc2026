
import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, MapPin, Share2, ChevronDown, ChevronUp, Users, BarChart2, CalendarPlus } from 'lucide-react';
import type { Match, UserPreferences } from '../types';
import { getChannelsForCountry } from '../data/tvChannels';
import { isKnockoutTeam } from '../data/processFixtures';
import { getTeamFlag } from '../data/teamFlags';
import type { TranslationKey } from '../data/i18n';
import { formatMatchTime, formatMatchDate, secondsUntil, formatCountdown } from '../utils/time';

interface MatchRowProps {
  match: Match;
  prefs: UserPreferences;
  t: (key: TranslationKey) => string;
  onToggleFavourite: (id: string) => void;
  isToday: boolean;
  timezone: string;
  /** When true, this match is from a club competition: skip flags and broadcast lookup */
  isClubComp?: boolean;
}

// ---------------------------------------------------------------------------
// Per-match ICS download helper
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toICSDate(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    'T' +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    '00Z'
  );
}

function downloadMatchICS(match: Match, countryCode: string): void {
  const channels = getChannelsForCountry(countryCode);
  const channelStr = channels.length > 0 ? channels.join(', ') : 'Check local listings';

  const start = toICSDate(match.utcDate);
  const end = toICSDate(new Date(match.utcDate.getTime() + 2 * 60 * 60 * 1000));
  const title = `${match.team1} vs ${match.team2}`;
  const desc = [
    `World Cup 2026 - ${match.round}`,
    match.group ? `Group: ${match.group}` : '',
    `Venue: ${match.venue}`,
    `Watch on: ${channelStr}`,
  ].filter(Boolean).join('\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//World Cup 2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${match.venue}`,
    `UID:wc2026-${match.id}@wc2026`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wc2026-${match.team1.toLowerCase().replace(/\s+/g, '-')}-vs-${match.team2.toLowerCase().replace(/\s+/g, '-')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// Tab options for the expanded detail panel.
type DetailTab = 'h2h' | 'lineups' | 'stats';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status, minute, t }: { status: Match['status']; minute?: number; t: (k: TranslationKey) => string }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        {minute ? `${minute}'` : t('live')}
      </span>
    );
  }
  if (status === 'ht') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-400 text-amber-900">
        {t('ht')}
      </span>
    );
  }
  if (status === 'ft') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
        {t('ft')}
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// TeamNameInline — always-horizontal variant: flag + truncated name
// home side (align="right"): name then flag, whole block right-aligned
// away side (align="left"): flag then name, whole block left-aligned
// ---------------------------------------------------------------------------

function TeamNameInline({
  name,
  spoilerMode,
  tbd,
  align,
  showFlag = true,
}: {
  name: string;
  spoilerMode: boolean;
  tbd: string;
  align: 'left' | 'right';
  showFlag?: boolean;
}) {
  if (!spoilerMode && isKnockoutTeam(name)) {
    return <span className="text-neutral-400 italic text-sm truncate">{tbd}</span>;
  }
  const flag = showFlag ? getTeamFlag(name) : null;
  return (
    <span
      className={[
        'text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-tight',
        'flex items-center gap-1 min-w-0',
        align === 'right' ? 'flex-row-reverse' : '',
      ].join(' ')}
    >
      <span className="truncate">{name}</span>
      {flag && <span aria-hidden="true" className="flex-shrink-0">{flag}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CountdownInline — renders as two sibling fragments (separator + text)
// so it slots into the meta line naturally
// ---------------------------------------------------------------------------

function CountdownInline({ utcDate, t }: { utcDate: Date; t: (k: TranslationKey) => string }) {
  const [secs, setSecs] = useState(() => secondsUntil(utcDate));

  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => setSecs(secondsUntil(utcDate)), 30_000);
    return () => clearInterval(id);
  }, [utcDate, secs]);

  if (secs <= 0) return null;
  const label = formatCountdown(secs);
  if (!label) return null;

  const mins = secs / 60;
  const urgency =
    mins <= 15
      ? 'text-red-500 dark:text-red-400 font-semibold'
      : mins <= 60
        ? 'text-amber-500 dark:text-amber-400 font-medium'
        : '';

  return (
    <>
      <span aria-hidden="true">·</span>
      <span className={urgency}>
        {t('kicksOffIn')} {label}
      </span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Channel abbreviation helper — keeps the meta line short on small screens
// "BBC One", "BBC Two" → "BBC"; "ITV1", "ITV4" → "ITV"; max 2 unique tokens
// ---------------------------------------------------------------------------

function abbreviateChannels(channels: string[]): string[] {
  const abbrev = (ch: string): string => {
    return ch
      .replace(/\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b/gi, '')
      .replace(/\d+/g, '')
      .trim()
      .split(/\s+/)
      [0]
      .toUpperCase();
  };

  const seen = new Set<string>();
  const result: string[] = [];
  for (const ch of channels) {
    const a = abbrev(ch);
    if (!seen.has(a)) {
      seen.add(a);
      result.push(a);
    }
    if (result.length === 2) break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Share button
// ---------------------------------------------------------------------------

function ShareButton({
  match,
  timezone,
  language,
  t,
}: {
  match: Match;
  timezone: string;
  language: string;
  t: (k: TranslationKey) => string;
}) {
  const [tooltip, setTooltip] = useState(false);

  const handleShare = useCallback(async () => {
    const time = formatMatchTime(match.utcDate, timezone);
    const date = formatMatchDate(match.utcDate, timezone, language);
    const title = `\u{1F3C6} ${match.team1} vs ${match.team2}`;
    const text = `Kicks off ${time} on ${date}`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // User cancelled — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
        setTooltip(true);
        setTimeout(() => setTooltip(false), 2000);
      } catch {
        // Clipboard not available — silently ignore
      }
    }
  }, [match, timezone, language]);

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={handleShare}
        className="p-1.5 rounded-lg transition-colors text-neutral-300 dark:text-neutral-600 hover:text-[var(--accent)]"
        aria-label={t('shareMatch')}
      >
        <Share2 size={16} />
      </button>
      {tooltip && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-neutral-800 text-white px-2 py-1 rounded shadow pointer-events-none z-10">
          {t('copied')}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// H2H panel
// ---------------------------------------------------------------------------

interface H2HGame {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
}

function h2hCacheKey(team1: string, team2: string): string {
  const sorted = [team1, team2].sort();
  return `h2h-${sorted[0]}-${sorted[1]}`;
}

// Fetch the last 5 head-to-head matches from football-data.org via the
// free /v4/teams/{id}/matches?competition=WC endpoint, falling back to a
// broader search. We look up team IDs by name against the teams API, then
// request H2H from the matches endpoint. Results are cached forever in
// localStorage since historical results never change.

// Known football-data.org team IDs for WC 2026 participants.
// These are stable integer IDs from the football-data.org database.
const FD_TEAM_IDS: Record<string, number> = {
  'Algeria': 1581,
  'Argentina': 7,
  'Australia': 712,
  'Austria': 816,
  'Belgium': 805,
  'Bosnia & Herzegovina': 1581, // approximate — fd uses BIH
  'Brazil': 6,
  'Canada': 732,
  'Cape Verde': 1780,
  'Colombia': 728,
  'Croatia': 799,
  'Czech Republic': 798,
  'DR Congo': 1636,
  'Ecuador': 730,
  'Egypt': 802,
  'England': 66,
  'France': 773,
  'Germany': 759,
  'Ghana': 1575,
  'Haiti': 1578,
  'Iran': 820,
  'Iraq': 1592,
  'Ivory Coast': 1591,
  'Japan': 811,
  'Jordan': 1593,
  'Mexico': 58,
  'Morocco': 1581, // fd uses MAR
  'Netherlands': 810,
  'New Zealand': 1565,
  'Norway': 812,
  'Panama': 1578,
  'Paraguay': 729,
  'Portugal': 765,
  'Qatar': 1581,
  'Saudi Arabia': 1576,
  'Scotland': 1977,
  'Senegal': 1586,
  'South Africa': 1575,
  'South Korea': 732,
  'Spain': 760,
  'Sweden': 807,
  'Switzerland': 788,
  'Tunisia': 1580,
  'Turkey': 826,
  'USA': 1810,
  'Uruguay': 631,
  'Uzbekistan': 1581,
};

type H2HState = 'idle' | 'loading' | 'loaded' | 'error';

function H2HPanel({ team1, team2, t }: { team1: string; team2: string; t: (k: TranslationKey) => string }) {
  const [state, setState] = useState<H2HState>('idle');
  const [games, setGames] = useState<H2HGame[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const cacheKey = h2hCacheKey(team1, team2);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setGames(JSON.parse(cached));
        setState('loaded');
        return;
      } catch {
        // corrupt cache — fall through to fetch
      }
    }

    setState('loading');

    const id1 = FD_TEAM_IDS[team1];
    const id2 = FD_TEAM_IDS[team2];

    if (!id1 || !id2) {
      // No known IDs — can't fetch H2H
      setState('loaded');
      setGames([]);
      return;
    }

    const url = `/api/h2h?team=${id1}&limit=20`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('not ok');
        return r.json() as Promise<{ matches: Array<{
          utcDate: string;
          homeTeam: { name: string };
          awayTeam: { name: string };
          score: { fullTime: { home: number | null; away: number | null } };
        }> }>;
      })
      .then((data) => {
        // Filter to matches involving both teams
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
        const n2 = norm(team2);
        const h2h: H2HGame[] = (data.matches ?? [])
          .filter((m) => norm(m.homeTeam.name) === n2 || norm(m.awayTeam.name) === n2)
          .slice(0, 5)
          .map((m) => ({
            date: m.utcDate.slice(0, 4),
            homeTeam: m.homeTeam.name,
            awayTeam: m.awayTeam.name,
            homeScore: m.score.fullTime.home,
            awayScore: m.score.fullTime.away,
          }));

        localStorage.setItem(cacheKey, JSON.stringify(h2h));
        setGames(h2h);
        setState('loaded');
      })
      .catch(() => {
        setState('error');
      });
  }, [team1, team2]);

  if (state === 'loading') {
    return (
      <div className="text-xs text-neutral-400 flex items-center gap-2 py-1">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-neutral-300 border-t-[var(--accent)] animate-spin" />
        {t('h2hLoading')}
      </div>
    );
  }

  if (state === 'error') {
    return <div className="text-xs text-neutral-400 py-1">{t('h2hError')}</div>;
  }

  if (state === 'loaded' && games.length === 0) {
    return <div className="text-xs text-neutral-400 py-1">{t('h2hNoData')}</div>;
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
        {t('h2hHistory')}
      </div>
      {games.map((g, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="w-10 text-right text-neutral-400">{g.date}</span>
          <span className="flex-1 truncate">{g.homeTeam}</span>
          <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
            {g.homeScore ?? '?'}&ndash;{g.awayScore ?? '?'}
          </span>
          <span className="flex-1 truncate">{g.awayTeam}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match detail — lineups + statistics (batched from a single /api/match/{id})
// ---------------------------------------------------------------------------

interface PlayerEntry {
  id: number;
  name: string;
  shirtNumber?: number;
  position?: string;
}

interface TeamLineup {
  lineup: PlayerEntry[];
  bench: PlayerEntry[];
}

interface StatEntry {
  type: string;
  home: string | number | null;
  away: string | number | null;
}

interface MatchDetailData {
  homeLineup: TeamLineup;
  awayLineup: TeamLineup;
  stats: StatEntry[];
}

type DetailState = 'idle' | 'loading' | 'loaded' | 'error';

// Mapping of football-data.org stat type names to i18n keys.
const STAT_KEY_MAP: Record<string, TranslationKey> = {
  'ball_possession':   'statPossession',
  'total_shots':       'statShots',
  'shots_on_goal':     'statShotsOnGoal',
  'shots_off_goal':    'statShotsOffGoal',
  'corner_kicks':      'statCorners',
  'fouls':             'statFouls',
  'offsides':          'statOffsides',
  'yellow_cards':      'statYellowCards',
  'red_cards':         'statRedCards',
  'goalkeeper_saves':  'statSaves',
  'throw_ins':         'statThrowIns',
  'goal_kicks':        'statGoalKicks',
};

// Order in which we display statistics rows.
const STAT_ORDER: (keyof typeof STAT_KEY_MAP)[] = [
  'ball_possession',
  'total_shots',
  'shots_on_goal',
  'shots_off_goal',
  'corner_kicks',
  'fouls',
  'offsides',
  'yellow_cards',
  'red_cards',
  'goalkeeper_saves',
  'throw_ins',
  'goal_kicks',
];

function matchDetailCacheKey(fdMatchId: number): string {
  return `match-detail-${fdMatchId}`;
}

// Raw shape returned by football-data.org /v4/matches/{id}
interface FDMatchDetail {
  homeTeam: {
    lineup?: Array<{ id: number; name: string; shirtNumber?: number; position?: string }>;
    bench?:  Array<{ id: number; name: string; shirtNumber?: number; position?: string }>;
    statistics?: Record<string, string | number | null>;
  };
  awayTeam: {
    lineup?: Array<{ id: number; name: string; shirtNumber?: number; position?: string }>;
    bench?:  Array<{ id: number; name: string; shirtNumber?: number; position?: string }>;
    statistics?: Record<string, string | number | null>;
  };
}

function parseDetail(raw: FDMatchDetail): MatchDetailData {
  const home = raw.homeTeam ?? {};
  const away = raw.awayTeam ?? {};

  const homeLineup: TeamLineup = {
    lineup: (home.lineup ?? []).map((p) => ({
      id: p.id, name: p.name, shirtNumber: p.shirtNumber, position: p.position,
    })),
    bench: (home.bench ?? []).map((p) => ({
      id: p.id, name: p.name, shirtNumber: p.shirtNumber, position: p.position,
    })),
  };

  const awayLineup: TeamLineup = {
    lineup: (away.lineup ?? []).map((p) => ({
      id: p.id, name: p.name, shirtNumber: p.shirtNumber, position: p.position,
    })),
    bench: (away.bench ?? []).map((p) => ({
      id: p.id, name: p.name, shirtNumber: p.shirtNumber, position: p.position,
    })),
  };

  // Build stats rows in display order.
  const hs = home.statistics ?? {};
  const as_ = away.statistics ?? {};
  const stats: StatEntry[] = STAT_ORDER
    .filter((key) => hs[key] !== undefined || as_[key] !== undefined)
    .map((key) => ({ type: key, home: hs[key] ?? null, away: as_[key] ?? null }));

  return { homeLineup, awayLineup, stats };
}

// Hook: fetch & cache match detail from /api/match/{fdMatchId}
function useMatchDetail(fdMatchId: number | undefined): { state: DetailState; detail: MatchDetailData | null } {
  const [state, setState] = useState<DetailState>('idle');
  const [detail, setDetail] = useState<MatchDetailData | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!fdMatchId || fetchedRef.current) return;
    fetchedRef.current = true;

    // Check persistent cache first — completed match data never changes.
    const cacheKey = matchDetailCacheKey(fdMatchId);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setDetail(JSON.parse(cached) as MatchDetailData);
        setState('loaded');
        return;
      } catch {
        // Corrupt cache — fall through to fetch.
      }
    }

    setState('loading');

    fetch(`/api/match/${fdMatchId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FDMatchDetail>;
      })
      .then((raw) => {
        const parsed = parseDetail(raw);
        // Only cache when we have actual lineup data (pre-match the arrays are empty).
        const hasData =
          parsed.homeLineup.lineup.length > 0 ||
          parsed.awayLineup.lineup.length > 0 ||
          parsed.stats.length > 0;
        if (hasData) {
          localStorage.setItem(cacheKey, JSON.stringify(parsed));
        }
        setDetail(parsed);
        setState('loaded');
      })
      .catch(() => {
        setState('error');
      });
  }, [fdMatchId]);

  return { state, detail };
}

// ---------------------------------------------------------------------------
// Lineups panel
// ---------------------------------------------------------------------------

function PlayerList({ players, t }: { players: PlayerEntry[]; t: (k: TranslationKey) => string }) {
  if (players.length === 0) {
    return <div className="text-xs text-neutral-400 italic">{t('lineupsNoData')}</div>;
  }
  return (
    <ul className="space-y-0.5">
      {players.map((p) => (
        <li key={p.id} className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
          {p.shirtNumber !== undefined && (
            <span className="w-5 text-right tabular-nums text-neutral-400 dark:text-neutral-500 flex-shrink-0 font-mono text-[11px]">
              {p.shirtNumber}
            </span>
          )}
          <span className="truncate">{p.name}</span>
          {p.position && (
            <span className="ml-auto text-[10px] uppercase tracking-wide text-neutral-400 flex-shrink-0">
              {p.position.slice(0, 3)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function LineupsPanel({
  homeTeam,
  awayTeam,
  fdMatchId,
  t,
}: {
  homeTeam: string;
  awayTeam: string;
  fdMatchId: number | undefined;
  t: (k: TranslationKey) => string;
}) {
  const { state, detail } = useMatchDetail(fdMatchId);

  if (!fdMatchId) {
    return <div className="text-xs text-neutral-400 py-1">{t('lineupsNoData')}</div>;
  }

  if (state === 'loading' || state === 'idle') {
    return (
      <div className="text-xs text-neutral-400 flex items-center gap-2 py-1">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-neutral-300 border-t-[var(--accent)] animate-spin" />
        {t('lineupsLoading')}
      </div>
    );
  }

  if (state === 'error') {
    return <div className="text-xs text-neutral-400 py-1">{t('lineupsError')}</div>;
  }

  if (!detail || (detail.homeLineup.lineup.length === 0 && detail.awayLineup.lineup.length === 0)) {
    return <div className="text-xs text-neutral-400 py-1">{t('lineupsNoData')}</div>;
  }

  return (
    <div>
      <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Users size={12} />
        {t('lineups')}
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        {/* Home */}
        <div>
          <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1 truncate">{homeTeam}</div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-400 mb-0.5">{t('startingXI')}</div>
          <PlayerList players={detail.homeLineup.lineup} t={t} />
          {detail.homeLineup.bench.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wide text-neutral-400 mt-2 mb-0.5">{t('bench')}</div>
              <PlayerList players={detail.homeLineup.bench} t={t} />
            </>
          )}
        </div>
        {/* Away */}
        <div>
          <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1 truncate">{awayTeam}</div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-400 mb-0.5">{t('startingXI')}</div>
          <PlayerList players={detail.awayLineup.lineup} t={t} />
          {detail.awayLineup.bench.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wide text-neutral-400 mt-2 mb-0.5">{t('bench')}</div>
              <PlayerList players={detail.awayLineup.bench} t={t} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Statistics panel
// ---------------------------------------------------------------------------

function StatBar({ value, max, side }: { value: number; max: number; side: 'home' | 'away' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className={[
        'h-1.5 rounded-full bg-[var(--accent)] transition-all',
        side === 'away' ? 'ml-auto' : '',
      ].join(' ')}
      style={{ width: `${pct}%` }}
    />
  );
}

function StatsPanel({
  fdMatchId,
  t,
}: {
  fdMatchId: number | undefined;
  t: (k: TranslationKey) => string;
}) {
  const { state, detail } = useMatchDetail(fdMatchId);

  if (!fdMatchId) {
    return <div className="text-xs text-neutral-400 py-1">{t('statsNoData')}</div>;
  }

  if (state === 'loading' || state === 'idle') {
    return (
      <div className="text-xs text-neutral-400 flex items-center gap-2 py-1">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-neutral-300 border-t-[var(--accent)] animate-spin" />
        {t('statsLoading')}
      </div>
    );
  }

  if (state === 'error') {
    return <div className="text-xs text-neutral-400 py-1">{t('statsError')}</div>;
  }

  if (!detail || detail.stats.length === 0) {
    return <div className="text-xs text-neutral-400 py-1">{t('statsNoData')}</div>;
  }

  return (
    <div>
      <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <BarChart2 size={12} />
        {t('matchStats')}
      </div>
      <div className="space-y-2">
        {detail.stats.map((row) => {
          const labelKey = STAT_KEY_MAP[row.type];
          const label = labelKey ? t(labelKey) : row.type;
          const hVal = typeof row.home === 'number' ? row.home : Number(row.home ?? 0);
          const aVal = typeof row.away === 'number' ? row.away : Number(row.away ?? 0);
          const max = Math.max(hVal, aVal, 1);

          // Possession is a percentage string — display differently.
          const isPossession = row.type === 'ball_possession';

          return (
            <div key={row.type}>
              {/* Values + label row */}
              <div className="flex items-center text-xs text-neutral-700 dark:text-neutral-300">
                <span className="w-10 tabular-nums font-semibold">
                  {row.home !== null ? row.home : '-'}
                  {isPossession ? '%' : ''}
                </span>
                <span className="flex-1 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
                  {label}
                </span>
                <span className="w-10 tabular-nums font-semibold text-right">
                  {row.away !== null ? row.away : '-'}
                  {isPossession ? '%' : ''}
                </span>
              </div>
              {/* Bar row */}
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex-1">
                  <StatBar value={isPossession ? hVal : hVal} max={isPossession ? 100 : max} side="home" />
                </div>
                <div className="flex-1">
                  <StatBar value={isPossession ? aVal : aVal} max={isPossession ? 100 : max} side="away" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MatchRow({
  match,
  prefs,
  t,
  onToggleFavourite,
  isToday,
  timezone,
  isClubComp = false,
}: MatchRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('h2h');
  const isFav = prefs.favouriteMatches.includes(match.id);
  // H2H only works for WC (national teams with known FD IDs)
  const knownTeams = !isClubComp && !isKnockoutTeam(match.team1) && !isKnockoutTeam(match.team2);
  // For club competitions broadcast rights are unknown — always show "check local listings"
  const channels = isClubComp ? [] : getChannelsForCountry(prefs.countryCode);
  const channelLabels = abbreviateChannels(channels);
  const showScore = prefs.spoilerMode && (match.status === 'ft' || match.status === 'live' || match.status === 'ht');

  const localTime = formatMatchTime(match.utcDate, timezone);

  // Meta line parts: channels, venue/city, countdown (for upcoming within 24 h)
  const venueName = match.city || match.venue;

  return (
    <div
      className={[
        'group flex flex-col gap-1.5',
        'px-3 py-2 rounded-xl transition-colors',
        isToday
          ? 'bg-[var(--accent)]/5 border border-[var(--accent)]/30'
          : 'bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800',
        isFav ? 'ring-1 ring-amber-400' : '',
      ].join(' ')}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Row 1 — [home team] [time/score] [away team]                        */}
      {/* Always horizontal, never stacks. truncate handles long names.       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-1.5">

        {/* Left — home team, right-aligned */}
        <div className="flex-1 flex justify-end items-center gap-1 min-w-0">
          <TeamNameInline name={match.team1} spoilerMode={prefs.spoilerMode} tbd={t('tbd')} align="right" showFlag={!isClubComp} />
        </div>

        {/* Centre — fixed width, time/score + optional status chip */}
        <div className="w-20 flex-shrink-0 flex flex-col items-center gap-0.5">
          {showScore && match.score1 !== undefined && match.score2 !== undefined ? (
            <span className="text-xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100 leading-none">
              {match.score1}&ndash;{match.score2}
            </span>
          ) : (
            <span className="text-lg font-bold tabular-nums text-neutral-800 dark:text-neutral-200 leading-none">
              {localTime}
            </span>
          )}
          {match.status !== 'upcoming' && (
            <StatusBadge status={match.status} minute={match.minute} t={t} />
          )}
        </div>

        {/* Right — away team, left-aligned */}
        <div className="flex-1 flex justify-start items-center gap-1 min-w-0">
          <TeamNameInline name={match.team2} spoilerMode={prefs.spoilerMode} tbd={t('tbd')} align="left" showFlag={!isClubComp} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2 — channels · venue · countdown (centered, one line)           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 leading-none">
        {channelLabels.length > 0 ? (
          <span>{channelLabels.join(' · ')}</span>
        ) : (
          <span className="italic">{t('unknownChannels')}</span>
        )}
        {venueName && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[8rem]">{venueName}</span>
          </>
        )}
        {match.status === 'upcoming' && (
          <CountdownInline utcDate={match.utcDate} t={t} />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 3 — group/round badge (left) + star · share · expand (right)    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-1">
        {/* Group / round badge */}
        {match.group ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-medium mr-auto whitespace-nowrap">
            {match.group.replace('Group ', 'Group ')}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium whitespace-nowrap mr-auto">
            {match.round}
          </span>
        )}

        {/* Favourite star */}
        <button
          onClick={() => onToggleFavourite(match.id)}
          className={[
            'flex-shrink-0 p-1.5 rounded-lg transition-colors',
            isFav
              ? 'text-amber-400 hover:text-amber-500'
              : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-400',
          ].join(' ')}
          aria-label={isFav ? t('removeFromFavourites') : t('addToFavourites')}
        >
          <Star size={15} fill={isFav ? 'currentColor' : 'none'} />
        </button>

        {/* Share */}
        <ShareButton
          match={match}
          timezone={timezone}
          language={prefs.language}
          t={t}
        />

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex-shrink-0 p-1.5 rounded-lg transition-colors text-neutral-300 dark:text-neutral-600 hover:text-[var(--accent)]"
          aria-label={expanded ? t('collapse') : t('expand')}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          {/* Venue detail on mobile + per-match ICS button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex md:hidden items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <MapPin size={12} className="flex-shrink-0" />
              <span>{match.venue || match.city}</span>
            </div>
            <button
              onClick={() => downloadMatchICS(match, prefs.countryCode)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors ml-auto"
              aria-label={t('exportMatch')}
            >
              <CalendarPlus size={12} />
              {t('exportMatch')}
            </button>
          </div>

          {/* Detail tabs */}
          <div className="flex items-center gap-1 border-b border-neutral-100 dark:border-neutral-800 pb-2">
            {knownTeams && (
              <button
                onClick={() => setDetailTab('h2h')}
                className={[
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  detailTab === 'h2h'
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
                ].join(' ')}
              >
                {t('h2hHistory')}
              </button>
            )}
            <button
              onClick={() => setDetailTab('lineups')}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                detailTab === 'lineups'
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
              ].join(' ')}
            >
              {t('lineups')}
            </button>
            <button
              onClick={() => setDetailTab('stats')}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                detailTab === 'stats'
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
              ].join(' ')}
            >
              {t('matchStats')}
            </button>
          </div>

          {/* Tab content */}
          {detailTab === 'h2h' && knownTeams && (
            <H2HPanel team1={match.team1} team2={match.team2} t={t} />
          )}
          {detailTab === 'lineups' && (
            <LineupsPanel
              homeTeam={match.team1}
              awayTeam={match.team2}
              fdMatchId={match.fdMatchId}
              t={t}
            />
          )}
          {detailTab === 'stats' && (
            <StatsPanel
              fdMatchId={match.fdMatchId}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}
