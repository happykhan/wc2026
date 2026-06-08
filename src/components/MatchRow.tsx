
import { format } from 'date-fns';
import { Star, Tv, MapPin } from 'lucide-react';
import type { Match, UserPreferences } from '../types';
import { getChannelsForCountry } from '../data/tvChannels';
import { isKnockoutTeam } from '../data/processFixtures';
import type { TranslationKey } from '../data/i18n';

interface MatchRowProps {
  match: Match;
  prefs: UserPreferences;
  t: (key: TranslationKey) => string;
  onToggleFavourite: (id: string) => void;
  isToday: boolean;
}

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

function TeamName({ name, spoilerMode }: { name: string; spoilerMode: boolean }) {
  if (!spoilerMode && isKnockoutTeam(name)) {
    return <span className="text-neutral-400 italic text-sm">TBD</span>;
  }
  return (
    <span className="font-medium text-neutral-900 dark:text-neutral-100 leading-tight">
      {name}
    </span>
  );
}

export function MatchRow({ match, prefs, t, onToggleFavourite, isToday }: MatchRowProps) {
  const isFav = prefs.favouriteMatches.includes(match.id);
  const channels = getChannelsForCountry(prefs.countryCode);
  const showScore = prefs.spoilerMode && (match.status === 'ft' || match.status === 'live' || match.status === 'ht');

  const localTime = format(match.utcDate, 'HH:mm');
  const localDate = format(match.utcDate, 'EEE d MMM');

  return (
    <div
      className={[
        'group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4',
        'px-4 py-3 rounded-xl transition-colors',
        isToday
          ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800'
          : 'bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800',
        isFav ? 'ring-1 ring-amber-400' : '',
      ].join(' ')}
    >
      {/* Date + time */}
      <div className="flex-shrink-0 w-28 text-left">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">{localDate}</div>
        <div className="text-base font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
          {localTime}
        </div>
      </div>

      {/* Teams + score */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
          <TeamName name={match.team1} spoilerMode={prefs.spoilerMode} />
          {showScore && match.score1 !== undefined && match.score2 !== undefined ? (
            <span className="text-lg font-bold tabular-nums text-neutral-800 dark:text-neutral-100 flex-shrink-0">
              {match.score1} – {match.score2}
            </span>
          ) : (
            <span className="text-neutral-400 dark:text-neutral-500 flex-shrink-0 font-light text-sm sm:text-base">vs</span>
          )}
          <TeamName name={match.team2} spoilerMode={prefs.spoilerMode} />
        </div>
        <StatusBadge status={match.status} minute={match.minute} t={t} />
      </div>

      {/* Venue */}
      <div className="hidden md:flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0 max-w-[160px]">
        <MapPin size={12} className="flex-shrink-0" />
        <span className="truncate">{match.city}</span>
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

      {/* Favourite star */}
      <button
        onClick={() => onToggleFavourite(match.id)}
        className={[
          'flex-shrink-0 p-1.5 rounded-lg transition-colors',
          isFav
            ? 'text-amber-400 hover:text-amber-500'
            : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-400',
        ].join(' ')}
        aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
      >
        <Star size={16} fill={isFav ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
