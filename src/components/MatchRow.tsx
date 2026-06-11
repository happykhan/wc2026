
import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, MapPin, Share2, Copy, Check, ChevronDown, ChevronUp, Users, BarChart2, CalendarPlus } from 'lucide-react';
import type { Match, UserPreferences } from '../types';
import aflTeamIds from '../data/aflTeamIds.json';
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
  /** When true (e.g. opened from a shared /match/:id link), start expanded and scroll into view. */
  initialExpanded?: boolean;
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
  const channels = getChannelsForCountry(countryCode, match.team1, match.team2);
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
  tbd,
  align,
  showFlag = true,
  crest,
}: {
  name: string;
  tbd: string;
  align: 'left' | 'right';
  showFlag?: boolean;
  crest?: string;
}) {
  // Undecided knockout slots ("2A", "W73") show as TBD in the schedule.
  if (isKnockoutTeam(name)) {
    return <span className="text-neutral-400 italic text-sm truncate">{tbd}</span>;
  }
  const flag = showFlag && !crest ? getTeamFlag(name) : null;
  return (
    <span
      className={[
        'text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-tight',
        'flex items-center gap-1 min-w-0',
        align === 'right' ? 'flex-row-reverse' : '',
      ].join(' ')}
    >
      <span className="truncate">{name}</span>
      {crest && (
        <img
          src={crest}
          alt=""
          aria-hidden="true"
          width={20}
          height={20}
          loading="lazy"
          className="flex-shrink-0 object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      {flag && <span aria-hidden="true" className="flex-shrink-0">{flag}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CountdownInline — renders as two sibling fragments (separator + text)
// so it slots into the meta line naturally
// ---------------------------------------------------------------------------

// Hide the countdown when kickoff is further away than this — a "200h" figure
// isn't meaningful; the date/time is enough until we're within 3 days.
const COUNTDOWN_MAX_SECONDS = 72 * 60 * 60;

function CountdownInline({ utcDate, t }: { utcDate: Date; t: (k: TranslationKey) => string }) {
  const [secs, setSecs] = useState(() => secondsUntil(utcDate));

  useEffect(() => {
    // Only tick while the countdown is actually on screen (within the window).
    if (secs <= 0 || secs > COUNTDOWN_MAX_SECONDS) return;
    const id = setInterval(() => setSecs(secondsUntil(utcDate)), 30_000);
    return () => clearInterval(id);
  }, [utcDate, secs]);

  if (secs <= 0 || secs > COUNTDOWN_MAX_SECONDS) return null;
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
// Share URL — /match/:id carries display fields as query params so the share
// page (and its OG image) can render without a server-side data lookup.
// ---------------------------------------------------------------------------

function matchShareUrl(match: Match, timezone: string, language: string): string {
  const params = new URLSearchParams({
    h: match.team1,
    a: match.team2,
    s: match.group || match.round,
    d: formatMatchDate(match.utcDate, timezone, language),
    v: match.city || match.venue,
  });
  return `${window.location.origin}/match/${match.id}?${params.toString()}`;
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
    const url = matchShareUrl(match, timezone, language);

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
// Copy button — copies a plain-text summary of the match to the clipboard
// ---------------------------------------------------------------------------

function CopyButton({
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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const time = formatMatchTime(match.utcDate, timezone);
    const date = formatMatchDate(match.utcDate, timezone, language);
    const url = matchShareUrl(match, timezone, language);
    const summary = `\u{1F3C6} ${match.team1} vs ${match.team2}\nKicks off ${time} on ${date}\n${url}`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }, [match, timezone, language]);

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg transition-colors text-neutral-300 dark:text-neutral-600 hover:text-[var(--accent)]"
        aria-label={t('copyMatch')}
      >
        {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
      </button>
      {copied && (
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

// Fetch head-to-head history from API-Football's /fixtures/headtohead endpoint
// (proxied via /api/afl). Unlike football-data.org's WC-only data, this returns
// real meetings across all competitions (friendlies, qualifiers, past World
// Cups). We look up each team's stable API-Football team ID by name, then cache
// results forever in localStorage since historical results never change.

// API-Football national-team IDs, keyed by the display names used in fixtures.
// Generated by scripts/fetch-afl-teams.mjs (see src/data/aflTeamIds.json).
const AFL_TEAM_IDS = aflTeamIds as unknown as Record<string, number>;

// Shape of a single fixture in the API-Football /fixtures/headtohead response.
interface AflH2HFixture {
  fixture: { date: string; status: { short: string } };
  league: { name: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
}

type H2HState = 'idle' | 'loading' | 'loaded' | 'error';

function H2HPanel({ team1, team2, t }: { team1: string; team2: string; t: (k: TranslationKey) => string }) {
  const [state, setState] = useState<H2HState>('idle');
  const [games, setGames] = useState<H2HGame[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const id1 = AFL_TEAM_IDS[team1];
    const id2 = AFL_TEAM_IDS[team2];

    if (!id1 || !id2) {
      // No known API-Football IDs — can't fetch H2H.
      setState('loaded');
      setGames([]);
      return;
    }

    // Key the cache by the (order-independent) ID pair so it's immutable.
    const cacheKey = `afl-h2h-${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
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

    // Note: the free plan ignores the "last" param and returns all H2H
    // fixtures; we filter to finished matches and keep the 5 most recent.
    fetch(`/api/afl/fixtures/headtohead?h2h=${id1}-${id2}`)
      .then((r) => {
        if (!r.ok) throw new Error('not ok');
        return r.json() as Promise<{ response?: AflH2HFixture[] }>;
      })
      .then((data) => {
        const h2h: H2HGame[] = (data.response ?? [])
          .filter((f) => f.fixture.status.short === 'FT')
          .sort(
            (a, b) =>
              new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
          )
          .slice(0, 5)
          .map((f) => ({
            date: f.fixture.date.slice(0, 4),
            homeTeam: f.teams.home.name,
            awayTeam: f.teams.away.name,
            homeScore: f.goals.home,
            awayScore: f.goals.away,
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

interface MatchDetailData {
  source: string | null;
  homeLineup: TeamLineup;
  awayLineup: TeamLineup;
  stats: StatRow[];
}

type DetailState = 'idle' | 'loading' | 'loaded' | 'error';

function normTeam(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '');
}

// Shape returned by our /api/matchdetail endpoint (ESPN with API-Football
// fallback, normalised server-side into one shape).
interface MdPlayer { id: number; name: string; number?: number; position?: string }
interface MdTeam { name: string; formation?: string; startXI: MdPlayer[]; bench: MdPlayer[]; stats: Record<string, string> }

function mdToLineup(t: MdTeam | undefined): TeamLineup {
  const map = (a?: MdPlayer[]): PlayerEntry[] =>
    (a ?? []).map((p, i) => ({ id: p.id || i, name: p.name, shirtNumber: p.number, position: p.position }));
  return { lineup: map(t?.startXI), bench: map(t?.bench) };
}

// Hook: lineups + stats for a match via /api/matchdetail, keyed by the ESPN
// event id (primary) or API-Football fixture id (fallback) the poller attached.
// No id → not live / not available → no data and NO upstream call. Shows cached
// values instantly, then refreshes every 3 min while open (edge-cached upstream).
function useMatchDetail(
  homeTeam: string,
  awayTeam: string,
  espnEventId: string | undefined,
  aflFixtureId: number | undefined,
): { state: DetailState; detail: MatchDetailData | null } {
  const [state, setState] = useState<DetailState>('idle');
  const [detail, setDetail] = useState<MatchDetailData | null>(null);

  useEffect(() => {
    if (!espnEventId && !aflFixtureId) { setState('loaded'); setDetail(null); return; }

    let cancelled = false;
    const cacheKey = `md-${espnEventId ?? 'afl' + aflFixtureId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setDetail(JSON.parse(cached) as MatchDetailData); setState('loaded'); } catch { /* corrupt */ }
    } else {
      setState('loading');
    }

    const n1 = normTeam(homeTeam);
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (espnEventId) params.set('espn', espnEventId);
        if (aflFixtureId) params.set('afl', String(aflFixtureId));
        const r = await fetch(`/api/matchdetail?${params.toString()}`);
        if (!r.ok) return;
        const j = (await r.json()) as { source: string | null; teams: MdTeam[] };
        const teams = j.teams ?? [];
        if (teams.length < 2) { if (!cancelled && !cached) setState('loaded'); return; }
        const homeT = teams.find((tm) => normTeam(tm.name) === n1) ?? teams[0];
        const awayT = teams.find((tm) => tm !== homeT) ?? teams[1];
        const stats: StatRow[] = STAT_ORDER
          .filter((k) => homeT.stats[k] != null || awayT.stats[k] != null)
          .map((k) => ({ type: k, home: homeT.stats[k] ?? null, away: awayT.stats[k] ?? null }));
        const md: MatchDetailData = {
          source: j.source,
          homeLineup: mdToLineup(homeT),
          awayLineup: mdToLineup(awayT),
          stats,
        };
        if (cancelled) return;
        const hasData = md.homeLineup.lineup.length > 0 || md.awayLineup.lineup.length > 0 || md.stats.length > 0;
        if (hasData) localStorage.setItem(cacheKey, JSON.stringify(md));
        setDetail(md);
        setState('loaded');
      } catch {
        if (!cancelled && !cached) setState('error');
      }
    };

    void load();
    const id = setInterval(() => void load(), 180_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [homeTeam, awayTeam, espnEventId, aflFixtureId]);

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
  espnEventId,
  aflFixtureId,
  t,
}: {
  homeTeam: string;
  awayTeam: string;
  espnEventId?: string;
  aflFixtureId?: number;
  t: (k: TranslationKey) => string;
}) {
  const { state, detail } = useMatchDetail(homeTeam, awayTeam, espnEventId, aflFixtureId);

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
// Statistics panel — possession, shots, corners, fouls, cards, pass accuracy
// from /api/matchdetail (ESPN primary, API-Football fallback). Canonical keys.
// ---------------------------------------------------------------------------

interface StatRow {
  type: string;
  home: string | number | null;
  away: string | number | null;
}

// Canonical stat key → existing i18n key.
const STAT_LABEL_KEYS: Record<string, TranslationKey> = {
  possession: 'statPossession',
  shots: 'statShots',
  shotsOnTarget: 'statShotsOnGoal',
  corners: 'statCorners',
  fouls: 'statFouls',
  offsides: 'statOffsides',
  yellowCards: 'statYellowCards',
  redCards: 'statRedCards',
  saves: 'statSaves',
};
const STAT_RAW_LABELS: Record<string, string> = {
  passAccuracy: 'Pass accuracy',
};
const STAT_ORDER = [
  'possession', 'shots', 'shotsOnTarget', 'corners', 'fouls',
  'offsides', 'yellowCards', 'redCards', 'saves', 'passAccuracy',
];

function toStatNum(v: string | number | null): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v.replace('%', '')) || 0;
  return 0;
}

function StatBar({ value, max, side }: { value: number; max: number; side: 'home' | 'away' }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div
      className={['h-1.5 rounded-full bg-[var(--accent)] transition-all', side === 'away' ? 'ml-auto' : ''].join(' ')}
      style={{ width: `${pct}%` }}
    />
  );
}

function StatsPanel({ homeTeam, awayTeam, espnEventId, aflFixtureId, t }: { homeTeam: string; awayTeam: string; espnEventId?: string; aflFixtureId?: number; t: (k: TranslationKey) => string }) {
  const { state, detail } = useMatchDetail(homeTeam, awayTeam, espnEventId, aflFixtureId);
  const rows = detail?.stats ?? null;

  if (state === 'loading' || state === 'idle') {
    return (
      <div className="text-xs text-neutral-400 flex items-center gap-2 py-1">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-neutral-300 border-t-[var(--accent)] animate-spin" />
        {t('statsLoading')}
      </div>
    );
  }
  if (state === 'error') return <div className="text-xs text-neutral-400 py-1">{t('statsError')}</div>;
  if (!rows || rows.length === 0) return <div className="text-xs text-neutral-400 py-1">{t('statsNoData')}</div>;

  return (
    <div>
      <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <BarChart2 size={12} />
        {t('matchStats')}
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const labelKey = STAT_LABEL_KEYS[row.type];
          const label = labelKey ? t(labelKey) : (STAT_RAW_LABELS[row.type] ?? row.type);
          const isPct = row.type === 'possession' || row.type === 'passAccuracy';
          const hv = toStatNum(row.home);
          const av = toStatNum(row.away);
          const max = isPct ? 100 : Math.max(hv, av, 1);
          return (
            <div key={row.type}>
              <div className="flex items-center text-xs text-neutral-700 dark:text-neutral-300">
                <span className="w-12 tabular-nums font-semibold">{row.home ?? '-'}</span>
                <span className="flex-1 text-center text-[11px] text-neutral-400 dark:text-neutral-500">{label}</span>
                <span className="w-12 tabular-nums font-semibold text-right">{row.away ?? '-'}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex-1"><StatBar value={hv} max={max} side="home" /></div>
                <div className="flex-1"><StatBar value={av} max={max} side="away" /></div>
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
  initialExpanded = false,
}: MatchRowProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const rootRef = useRef<HTMLDivElement>(null);
  const isFav = prefs.favouriteMatches.includes(match.id);

  // When opened from a shared link, scroll this card into view once.
  useEffect(() => {
    if (initialExpanded && rootRef.current) {
      rootRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // H2H only works for WC (national teams with known FD IDs)
  const knownTeams = !isClubComp && !isKnockoutTeam(match.team1) && !isKnockoutTeam(match.team2);
  // Default to the H2H tab when it's available, otherwise lineups.
  const [detailTab, setDetailTab] = useState<DetailTab>(knownTeams ? 'h2h' : 'lineups');
  // For club competitions broadcast rights are unknown — always show "check local listings"
  const channels = isClubComp ? [] : getChannelsForCountry(prefs.countryCode, match.team1, match.team2);
  const channelLabels = abbreviateChannels(channels);
  const showScore = match.status === 'ft' || match.status === 'live' || match.status === 'ht';

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
          <TeamNameInline name={match.team1} tbd={t('tbd')} align="right" showFlag={!isClubComp} crest={match.crest1} />
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
          <TeamNameInline name={match.team2} tbd={t('tbd')} align="left" showFlag={!isClubComp} crest={match.crest2} />
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

        {/* Copy to clipboard */}
        <CopyButton
          match={match}
          timezone={timezone}
          language={prefs.language}
          t={t}
        />

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
              espnEventId={match.espnEventId}
              aflFixtureId={match.aflFixtureId}
              t={t}
            />
          )}
          {detailTab === 'stats' && (
            <StatsPanel
              homeTeam={match.team1}
              awayTeam={match.team2}
              espnEventId={match.espnEventId}
              aflFixtureId={match.aflFixtureId}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}
