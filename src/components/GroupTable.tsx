
import type { Match, GroupStanding } from '../types';
import type { TranslationKey } from '../data/i18n';

interface GroupTableProps {
  group: string;
  matches: Match[];
  spoilerMode: boolean;
  t: (k: TranslationKey) => string;
}

function computeStandings(matches: Match[], spoilerMode: boolean): GroupStanding[] {
  const teams = Array.from(new Set(matches.flatMap((m) => [m.team1, m.team2])));
  const standings: Map<string, GroupStanding> = new Map(
    teams.map((t) => [t, { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }])
  );

  if (spoilerMode) {
    for (const m of matches) {
      if (m.status !== 'ft' || m.score1 === undefined || m.score2 === undefined) continue;
      const s1 = standings.get(m.team1)!;
      const s2 = standings.get(m.team2)!;
      s1.played++; s2.played++;
      s1.gf += m.score1; s1.ga += m.score2;
      s2.gf += m.score2; s2.ga += m.score1;
      s1.gd = s1.gf - s1.ga; s2.gd = s2.gf - s2.ga;
      if (m.score1 > m.score2) { s1.won++; s1.points += 3; s2.lost++; }
      else if (m.score1 < m.score2) { s2.won++; s2.points += 3; s1.lost++; }
      else { s1.drawn++; s1.points++; s2.drawn++; s2.points++; }
    }
  }

  return Array.from(standings.values()).sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );
}

export function GroupTable({ group, matches, spoilerMode, t }: GroupTableProps) {
  const standings = computeStandings(matches, spoilerMode);

  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
      <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-between">
        <span className="font-semibold text-sm text-neutral-700 dark:text-neutral-200">{group}</span>
        {!spoilerMode && (
          <span className="text-xs text-neutral-400 italic">Enable spoilers to see live standings</span>
        )}
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
          {standings.map((s, i) => (
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
                <span className="font-medium text-neutral-800 dark:text-neutral-200">{s.team}</span>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
