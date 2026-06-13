import { useState } from 'react';
import { X, Search, SlidersHorizontal } from 'lucide-react';
import type { FilterState } from '../types';
import type { TranslationKey } from '../data/i18n';
import { localizedTeamName } from '../data/teamFlags';

interface FilterBarProps {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  teams: string[];
  groups: string[];
  language: string;
  t: (k: TranslationKey) => string;
  showFavouritesTab: boolean;
}

const pill =
  'px-3 py-1.5 rounded-full text-sm bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 border-none outline-none focus:outline-[var(--accent)] cursor-pointer';

export function FilterBar({ filters, setFilters, teams, groups, language, t, showFavouritesTab }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const advancedCount = [filters.team, filters.group, filters.date].filter(Boolean).length;
  const hasActiveFilters = advancedCount > 0 || filters.favouritesOnly || filters.search;

  return (
    <div className="w-full space-y-2">
      {/* Always-visible: search · favourites · filters toggle · clear */}
      <div className="flex flex-wrap gap-2 items-center">
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 focus-within:ring-1 focus-within:ring-[var(--accent)] flex-1 min-w-[140px] max-w-xs">
          <Search size={14} className="text-neutral-400 flex-shrink-0" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder={t('searchPlaceholder')}
            className="bg-transparent border-none outline-none focus:outline-none placeholder:text-neutral-400 w-full"
          />
        </label>

        {showFavouritesTab && (
          <button
            onClick={() => setFilters({ ...filters, favouritesOnly: !filters.favouritesOnly })}
            className={[
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filters.favouritesOnly
                ? 'bg-amber-400 text-amber-900'
                : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-amber-50 dark:hover:bg-amber-900/20',
            ].join(' ')}
          >
            ★ {t('favourites')}
          </button>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            open || advancedCount > 0
              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
          ].join(' ')}
        >
          <SlidersHorizontal size={14} />
          {t('filters')}
          {advancedCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold">
              {advancedCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={() => { setFilters({ team: '', group: '', date: '', favouritesOnly: false, search: '' }); setOpen(false); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <X size={12} />
            {t('clearFilters')}
          </button>
        )}
      </div>

      {/* Collapsible advanced filters: group · team · date */}
      {open && (
        <div className="flex flex-wrap gap-2 items-center pt-0.5">
          <select value={filters.group} onChange={(e) => setFilters({ ...filters, group: e.target.value })} className={pill}>
            <option value="">{t('filterByGroup')}</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            <option value="knockout">{t('knockout')}</option>
          </select>

          <select value={filters.team} onChange={(e) => setFilters({ ...filters, team: e.target.value })} className={pill}>
            <option value="">{t('filterByTeam')}</option>
            {[...teams]
              .sort((a, b) => localizedTeamName(a, language).localeCompare(localizedTeamName(b, language)))
              .map((team) => <option key={team} value={team}>{localizedTeamName(team, language)}</option>)}
          </select>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 cursor-pointer">
            <span className="text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{t('filterByDate')}</span>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="bg-transparent border-none outline-none focus:outline-none text-neutral-700 dark:text-neutral-300 cursor-pointer"
              style={{ colorScheme: 'auto' }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
