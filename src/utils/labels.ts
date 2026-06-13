// Localises a group label by translating the word "Group" while keeping the
// letter unchanged: "Group A" → "Grupo A" (es) / "Groupe A" (fr) / "Gruppe A" (de).
// Pass the already-translated word (t('group')) so this stays pure and testable.
export function localizedGroupName(group: string | null | undefined, groupWord: string): string {
  if (!group) return group ?? '';
  const m = /^Group\s+(.+)$/i.exec(group);
  return m ? `${groupWord} ${m[1]}` : group;
}
