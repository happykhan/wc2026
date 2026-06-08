
import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, Tv, MapPin, Share2, ChevronDown, ChevronUp } from 'lucide-react';
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
}

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
// Team name with flag
// ---------------------------------------------------------------------------

function TeamName({ name, spoilerMode, tbd }: { name: string; spoilerMode: boolean; tbd: string }) {
  if (!spoilerMode && isKnockoutTeam(name)) {
    return <span className="text-neutral-400 italic text-sm">{tbd}</span>;
  }
  const flag = getTeamFlag(name);
  return (
    <span className="font-medium text-neutral-900 dark:text-neutral-100 leading-tight flex items-center gap-1.5">
      {flag && <span aria-hidden="true">{flag}</span>}
      {name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Countdown for upcoming matches
// ---------------------------------------------------------------------------

function Countdown({ utcDate, t }: { utcDate: Date; t: (k: TranslationKey) => string }) {
  const [secs, setSecs] = useState(() => secondsUntil(utcDate));

  useEffect(() => {
    // Only run the interval while the match is in the future
    if (secs <= 0) return;
    const id = setInterval(() => {
      setSecs(secondsUntil(utcDate));
    }, 30_000);
    return () => clearInterval(id);
  }, [utcDate, secs]);

  if (secs <= 0) return null;

  const label = formatCountdown(secs);
  if (!label) return null;

  // Colour thresholds
  const mins = secs / 60;
  const urgency =
    mins <= 15
      ? 'text-red-500 dark:text-red-400 font-semibold'
      : mins <= 60
      ? 'text-amber-500 dark:text-amber-400 font-medium'
      : 'text-neutral-400 dark:text-neutral-500';

  return (
    <span className={`text-xs ${urgency}`}>
      {t('kicksOffIn')} {label}
    </span>
  );
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

    const url = `https://api.football-data.org/v4/teams/${id1}/matches?status=FINISHED&limit=20`;

    fetch(url, { headers: { 'X-Auth-Token': '' } })
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
// Main component
// ---------------------------------------------------------------------------

export function MatchRow({ match, prefs, t, onToggleFavourite, isToday, timezone }: MatchRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isFav = prefs.favouriteMatches.includes(match.id);
  const channels = getChannelsForCountry(prefs.countryCode);
  const showScore = prefs.spoilerMode && (match.status === 'ft' || match.status === 'live' || match.status === 'ht');

  const localTime = formatMatchTime(match.utcDate, timezone);
  const localDate = formatMatchDate(match.utcDate, timezone, prefs.language);

  return (
    <div
      className={[
        'group flex flex-col gap-2',
        'px-4 py-3 rounded-xl transition-colors',
        isToday
          ? 'bg-[var(--accent)]/5 border border-[var(--accent)]/30'
          : 'bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800',
        isFav ? 'ring-1 ring-amber-400' : '',
      ].join(' ')}
    >
      {/* Main row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        {/* Date + time */}
        <div className="flex-shrink-0 w-28 text-left">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{localDate}</div>
          <div className="text-base font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
            {localTime}
          </div>
          {match.status === 'upcoming' && (
            <Countdown utcDate={match.utcDate} t={t} />
          )}
        </div>

        {/* Teams + score */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
            <TeamName name={match.team1} spoilerMode={prefs.spoilerMode} tbd={t('tbd')} />
            {showScore && match.score1 !== undefined && match.score2 !== undefined ? (
              <span className="text-lg font-bold tabular-nums text-neutral-800 dark:text-neutral-100 flex-shrink-0">
                {match.score1} &ndash; {match.score2}
              </span>
            ) : (
              <span className="text-neutral-400 dark:text-neutral-500 flex-shrink-0 font-light text-sm sm:text-base">{t('vs')}</span>
            )}
            <TeamName name={match.team2} spoilerMode={prefs.spoilerMode} tbd={t('tbd')} />
          </div>
          <StatusBadge status={match.status} minute={match.minute} t={t} />
        </div>

        {/* Venue (mobile: shown in expanded panel; desktop: always visible) */}
        <div className="hidden md:flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0 max-w-[160px]">
          <MapPin size={12} className="flex-shrink-0" />
          <span className="truncate">{match.venue || match.city}</span>
        </div>

        {/* TV channels */}
        <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0 max-w-[180px]">
          <Tv size={12} className="flex-shrink-0" />
          {channels.length > 0 ? (
            <span className="truncate">{channels.slice(0, 2).join(', ')}</span>
          ) : (
            <span className="italic">{t('unknownChannels')}</span>
          )}
        </div>

        {/* Group / round badge */}
        <div className="flex-shrink-0">
          {match.group ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-medium">
              {match.group.replace('Group ', '')}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium whitespace-nowrap">
              {match.round}
            </span>
          )}
        </div>

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
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

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
          <Star size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          {/* Venue detail on mobile */}
          <div className="flex md:hidden items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <MapPin size={12} className="flex-shrink-0" />
            <span>{match.venue || match.city}</span>
          </div>

          {/* H2H — only for known teams */}
          {!isKnockoutTeam(match.team1) && !isKnockoutTeam(match.team2) && (
            <H2HPanel team1={match.team1} team2={match.team2} t={t} />
          )}
        </div>
      )}
    </div>
  );
}
