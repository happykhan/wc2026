
import type { Match } from '../types';
import { GroupTable } from '../components/GroupTable';
import { allGroups } from '../data/processFixtures';
import type { TranslationKey } from '../data/i18n';

interface GroupsProps {
  matches: Match[];
  t: (k: TranslationKey) => string;
}

export function Groups({ matches, t }: GroupsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {allGroups.map((group) => (
          <GroupTable
            key={group}
            group={group}
            matches={matches.filter((m) => m.group === group)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
