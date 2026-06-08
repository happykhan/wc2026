
import type { Match, UserPreferences } from '../types';
import { GroupTable } from '../components/GroupTable';
import { allGroups } from '../data/processFixtures';
import type { TranslationKey } from '../data/i18n';

interface GroupsProps {
  matches: Match[];
  prefs: UserPreferences;
  t: (k: TranslationKey) => string;
  onToggleSpoilers: () => void;
}

export function Groups({ matches, prefs, t, onToggleSpoilers }: GroupsProps) {
  return (
    <div className="space-y-4">
      {!prefs.spoilerMode && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
          {t('spoilerBannerOff')}{' '}
          <button
            onClick={onToggleSpoilers}
            className="underline font-medium hover:opacity-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {t('spoilerEnableHint')}
          </button>{' '}
          {t('spoilerBannerOffSuffix')}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {allGroups.map((group) => (
          <GroupTable
            key={group}
            group={group}
            matches={matches.filter((m) => m.group === group)}
            spoilerMode={prefs.spoilerMode}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
