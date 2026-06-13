
import type { Match } from '../types';
import { GroupTable } from '../components/GroupTable';
import { allGroups } from '../data/processFixtures';
import type { TranslationKey } from '../data/i18n';

interface GroupsProps {
  matches: Match[];
  language: string;
  t: (k: TranslationKey) => string;
}

export function Groups({ matches, language, t }: GroupsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {allGroups.map((group) => (
          <GroupTable
            key={group}
            group={group}
            matches={matches.filter((m) => m.group === group)}
            language={language}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
