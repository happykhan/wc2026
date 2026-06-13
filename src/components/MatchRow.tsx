
import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, MapPin, Tv, Share2, Copy, Check, ChevronDown, ChevronUp, CalendarPlus } from 'lucide-react';
import type { Match, UserPreferences } from '../types';
import { getChannelsForCountry } from '../data/tvChannels';
import { isKnockoutTeam } from '../data/processFixtures';
import { getTeamFlag, localizedTeamName } from '../data/teamFlags';
import type { TranslationKey } from '../data/i18n';
import { formatMatchTime, formatMatchDate, secondsUntil, formatCountdown } from '../utils/time';
import { liveClockLabel } from '../utils/liveClock';
import { localizedGroupName } from '../utils/labels';
import { H2HPanel, LineupsPanel, StatsPanel, TimelinePanel } from './MatchDetail';

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
type DetailTab = 'h2h' | 'lineups' | 'stats' | 'timeline';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status, minute, minuteAt, t }: { status: Match['status']; minute?: number; minuteAt?: number; t: (k: TranslationKey) => string }) {
  // Run a live MM:SS clock that ticks every second. The feed only carries whole
  // minutes (ESPN's clock is minute-granular), so we extrapolate seconds from
  // `minuteAt` (when that minute was first observed). +30s centres the unavoidable
  // 0–60s sampling lag (otherwise the badge always trails the TV clock). The anchor
  // holds steady while the minute plateaus (e.g. 90' through stoppage), so the
  // clock counts up smoothly; the 15-min cap only guards a stalled poller.
  const [, tick] = useState(0);
  useEffect(() => {
    if (status !== 'live') return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (status === 'live') {
    const label =
      minute != null && minuteAt
        ? liveClockLabel(minute, minuteAt, Date.now())
        : minute != null
          ? `${minute}'`
          : t('live');
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white animate-pulse tabular-nums">
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        {label}
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
  language,
  showFlag = true,
  crest,
}: {
  name: string;
  tbd: string;
  align: 'left' | 'right';
  language: string;
  showFlag?: boolean;
  crest?: string;
}) {
  // Undecided knockout slots ("2A", "W73") show as TBD in the schedule.
  if (isKnockoutTeam(name)) {
    return <span className="text-neutral-400 italic text-sm truncate">{tbd}</span>;
  }
  // Match logic uses the canonical English name; only the displayed label is localised.
  const flag = showFlag && !crest ? getTeamFlag(name) : null;
  return (
    <span
      className={[
        'text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-tight',
        'flex items-center gap-1 min-w-0',
        align === 'right' ? 'flex-row-reverse' : '',
      ].join(' ')}
    >
      <span className="truncate">{localizedTeamName(name, language)}</span>
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

// ---------------------------------------------------------------------------
// Share URL — /match/:id carries display fields as query params so the share
// page (and its OG image) can render without a server-side data lookup.
// ---------------------------------------------------------------------------

// Always share the custom domain so previews show worldcup.happykhan.com,
// regardless of which host the app was opened on.
const CANONICAL_ORIGIN = 'https://worldcup.happykhan.com';

function matchShareUrl(match: Match, timezone: string, language: string): string {
  const params = new URLSearchParams({
    h: match.team1,
    a: match.team2,
    s: match.group || match.round,
    d: formatMatchDate(match.utcDate, timezone, language),
    v: match.city || match.venue,
  });
  return `${CANONICAL_ORIGIN}/match/${match.id}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Share button
// ---------------------------------------------------------------------------

function ShareButton({
  match,
  timezone,
  language,
  hour12,
  t,
}: {
  match: Match;
  timezone: string;
  language: string;
  hour12: boolean;
  t: (k: TranslationKey) => string;
}) {
  const [tooltip, setTooltip] = useState(false);

  const handleShare = useCallback(async () => {
    const time = formatMatchTime(match.utcDate, timezone, hour12);
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
  }, [match, timezone, language, hour12]);

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
  hour12,
  t,
}: {
  match: Match;
  timezone: string;
  language: string;
  hour12: boolean;
  t: (k: TranslationKey) => string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const time = formatMatchTime(match.utcDate, timezone, hour12);
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
  }, [match, timezone, language, hour12]);

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
  // A match featuring the user's followed team gets their accent colour edge.
  const followedTeam = !isClubComp && (prefs.favouriteTeams.includes(match.team1) || prefs.favouriteTeams.includes(match.team2));

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
  const primaryChannel = channels[0]; // the main TV channel to tune into (e.g. ITV1, BBC One)
  const showScore = match.status === 'ft' || match.status === 'live' || match.status === 'ht';

  const localTime = formatMatchTime(match.utcDate, timezone, prefs.hour12);

  // Meta line parts: channels, venue/city, countdown (for upcoming within 24 h)
  const venueName = match.city || match.venue;

  return (
    <div
      className={[
        'group flex flex-col gap-1.5',
        'px-3 py-2 rounded-xl transition-all shadow-sm hover:shadow-md',
        isToday
          ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/40'
          : 'bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800',
        // Accent left edge threads the team colour through every card; a followed
        // team gets the full-strength bar.
        followedTeam ? 'border-l-[4px] border-l-[var(--accent)]' : 'border-l-[3px] border-l-[var(--accent)]/50',
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
          <TeamNameInline name={match.team1} tbd={t('tbd')} align="right" language={prefs.language} showFlag={!isClubComp} crest={match.crest1} />
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
            <StatusBadge status={match.status} minute={match.minute} minuteAt={match.minuteAt} t={t} />
          )}
        </div>

        {/* Right — away team, left-aligned */}
        <div className="flex-1 flex justify-start items-center gap-1 min-w-0">
          <TeamNameInline name={match.team2} tbd={t('tbd')} align="left" language={prefs.language} showFlag={!isClubComp} crest={match.crest2} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2 — stage · venue · channel · countdown, star + expand right.    */}
      {/* The primary channel (which one to tune into) shows above the fold.   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 leading-none">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-center pl-7">
          {(match.group || match.round) && (
            <span className="font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
              {match.group ? localizedGroupName(match.group, t('group')) : match.round}
            </span>
          )}
          {(match.group || match.round) && venueName && <span aria-hidden="true">·</span>}
          {venueName && <span className="truncate max-w-[8rem]">{venueName}</span>}
          {primaryChannel && (
            <>
              {(match.group || match.round || venueName) && <span aria-hidden="true">·</span>}
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                <Tv size={11} className="flex-shrink-0" />{primaryChannel}
              </span>
            </>
          )}
          {match.status === 'upcoming' && (
            <>
              <span aria-hidden="true">·</span>
              <CountdownInline utcDate={match.utcDate} t={t} />
            </>
          )}
        </div>

        {/* Favourite star */}
        <button
          onClick={() => onToggleFavourite(match.id)}
          className={[
            'flex-shrink-0 p-1 rounded-lg transition-colors',
            isFav ? 'text-amber-400 hover:text-amber-500' : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-400',
          ].join(' ')}
          aria-label={isFav ? t('removeFromFavourites') : t('addToFavourites')}
        >
          <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
        </button>

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex-shrink-0 p-1 rounded-lg transition-colors text-neutral-300 dark:text-neutral-600 hover:text-[var(--accent)]"
          aria-label={expanded ? t('collapse') : t('expand')}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          {/* Venue + where to watch */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <MapPin size={12} className="flex-shrink-0" />
              {match.venue || match.city}
            </span>
            <span className="flex items-center gap-1.5">
              <Tv size={12} className="flex-shrink-0" />
              {channels.length > 0 ? channels.join(' · ') : <span className="italic">{t('unknownChannels')}</span>}
            </span>
          </div>

          {/* Actions: copy · share · add to calendar */}
          <div className="flex items-center gap-1.5">
            <CopyButton match={match} timezone={timezone} language={prefs.language} hour12={prefs.hour12} t={t} />
            <ShareButton match={match} timezone={timezone} language={prefs.language} hour12={prefs.hour12} t={t} />
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
            <button
              onClick={() => setDetailTab('timeline')}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                detailTab === 'timeline'
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
              ].join(' ')}
            >
              {t('timeline')}
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
          {detailTab === 'timeline' && (
            <TimelinePanel
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
