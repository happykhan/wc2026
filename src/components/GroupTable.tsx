
import type { Match } from '../types';
import type { TranslationKey } from '../data/i18n';
import { localizedTeamName } from '../data/teamFlags';
import { localizedGroupName } from '../utils/labels';
import { computeStandings } from '../data/standings';
import { getQualificationState } from '../data/qualification';

interface GroupTableProps {
  group: string;
  matches: Match[];
  language: string;
  t: (k: TranslationKey) => string;
}

export function GroupTable({ group, matches, language, t }: GroupTableProps) {
  const standings = computeStandings(matches);

  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
      <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-between">
        <span className="font-semibold text-sm text-neutral-700 dark:text-neutral-200">{localizedGroupName(group, t('group'))}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-500 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-800">
            <th className="text-left px-3 py-2 font-medium">{t('team')}</th>
            <th className="px-2 py-2 font-medium text-center">{t('played')}</th>
            <th className="px-2 py-2 font-medium text-center">{t('won')}</th>
            <th className="px-2 py-2 font-medium text-center">{t('drawn')}</th>
            <th className="px-2 py-2 font-medium text-center">{t('lost')}</th>
            <th className="px-2 py-2 font-medium text-center">{t('goalsFor')}</th>
            <th className="px-2 py-2 font-medium text-center">{t('goalsAgainst')}</th>
            <th className="px-2 py-2 font-medium text-center">{t('goalDifference')}</th>
            <th className="px-2 py-2 font-medium text-center">{t('points')}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const qualificationState = getQualificationState(s.team);
            return (
              <tr
                key={s.team}
                className={[
                  'border-b last:border-0 border-neutral-50 dark:border-neutral-800/50',
                  i < 3 ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50/50 dark:bg-neutral-900/50',
                ].join(' ')}
              >
                <td className="px-3 py-2.5 flex items-center gap-2">
                  {i < 3 && (
                    <span className={[
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      i < 2 ? 'bg-green-500' : 'bg-blue-400',
                    ].join(' ')} title={i < 2 ? 'Qualify' : 'Potential playoff'} />
                  )}
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{localizedTeamName(s.team, language)}</span>
                  {qualificationState === 'qualified' && (
                    <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-green-700 dark:border-green-800/80 dark:bg-green-950/50 dark:text-green-300">
                      {t('qualified')}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-center text-neutral-600 dark:text-neutral-400">{s.played}</td>
                <td className="px-2 py-2.5 text-center text-neutral-600 dark:text-neutral-400">{s.won}</td>
                <td className="px-2 py-2.5 text-center text-neutral-600 dark:text-neutral-400">{s.drawn}</td>
                <td className="px-2 py-2.5 text-center text-neutral-600 dark:text-neutral-400">{s.lost}</td>
                <td className="px-2 py-2.5 text-center text-neutral-600 dark:text-neutral-400">{s.gf}</td>
                <td className="px-2 py-2.5 text-center text-neutral-600 dark:text-neutral-400">{s.ga}</td>
                <td className="px-2 py-2.5 text-center font-medium text-neutral-700 dark:text-neutral-300">
                  {s.gd > 0 ? `+${s.gd}` : s.gd}
                </td>
                <td className="px-2 py-2.5 text-center font-bold text-neutral-900 dark:text-neutral-100">{s.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
