import { useMemo } from 'react';
import type { Match, UserPreferences } from '../types';
import type { TranslationKey } from '../data/i18n';
import { buildBracket, type BracketMatch } from '../data/bracket';
import { getTeamFlag } from '../data/teamFlags';
import { isKnockoutTeam } from '../data/processFixtures';
import { formatMatchDate, formatMatchTime } from '../utils/time';

interface BracketProps {
  matches: Match[];
  prefs: UserPreferences;
  t: (k: TranslationKey) => string;
}

function TeamLine({
  label,
  resolved,
  score,
  isWinner,
}: {
  label: string;
  resolved: boolean;
  score?: number;
  isWinner: boolean;
}) {
  const flag = resolved && !isKnockoutTeam(label) ? getTeamFlag(label) : null;
  return (
    <div
      className={[
        'flex items-center gap-1.5 px-2 py-1 min-w-0',
        isWinner ? 'font-semibold text-neutral-900 dark:text-neutral-100' : '',
        !resolved ? 'text-neutral-400 dark:text-neutral-500 italic' : 'text-neutral-700 dark:text-neutral-300',
      ].join(' ')}
    >
      {flag && <span aria-hidden="true" className="flex-shrink-0">{flag}</span>}
      <span className="truncate text-xs">{label}</span>
      {score !== undefined && (
        <span className="ml-auto tabular-nums font-mono text-xs text-neutral-800 dark:text-neutral-200 flex-shrink-0">
          {score}
        </span>
      )}
    </div>
  );
}

function BracketCard({ m, prefs }: { m: BracketMatch; prefs: UserPreferences }) {
  const live = m.status === 'live' || m.status === 'ht';
  const date = formatMatchDate(m.utcDate, prefs.timezone, prefs.language).replace(/,.*$/, '');
  const time = formatMatchTime(m.utcDate, prefs.timezone, prefs.hour12);
  return (
    <div
      className={[
        'rounded-lg border bg-white dark:bg-neutral-900 w-44 flex-shrink-0',
        live
          ? 'border-red-400 dark:border-red-500'
          : 'border-neutral-200 dark:border-neutral-700',
      ].join(' ')}
    >
      <div className="px-2 pt-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {m.num ? `#${m.num}` : ''} {date} {time}
        </span>
        {live && <span className="text-[10px] font-semibold text-red-500">LIVE</span>}
        {m.status === 'ft' && <span className="text-[10px] text-neutral-400">FT</span>}
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        <TeamLine
          label={m.team1.label}
          resolved={m.team1.resolved}
          score={m.score1}
          isWinner={m.winner === 1}
        />
        <TeamLine
          label={m.team2.label}
          resolved={m.team2.resolved}
          score={m.score2}
          isWinner={m.winner === 2}
        />
      </div>
    </div>
  );
}

export function Bracket({ matches, prefs, t }: BracketProps) {
  const rounds = useMemo(() => buildBracket(matches), [matches]);

  if (rounds.length === 0) {
    return (
      <div className="py-16 text-center text-neutral-400 dark:text-neutral-500 text-sm">
        {t('bracketEmpty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Horizontally scrollable column layout — reads as a bracket, works on
          mobile via overflow-x. Vertical gaps grow per round so pairs roughly
          align with their next-round match. */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-3 md:gap-5 min-w-max">
          {rounds.map((round) => (
            <div key={round.key} className="flex flex-col">
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2 px-1 whitespace-nowrap">
                {round.title}
              </h3>
              <div
                className={[
                  'flex flex-col justify-around flex-1',
                  round.key === 'r32' ? 'gap-2' : round.key === 'r16' ? 'gap-4' : 'gap-6',
                ].join(' ')}
              >
                {round.matches.map((m, i) => (
                  <BracketCard key={m.matchId + i} m={m} prefs={prefs} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
