
import { X, Search } from 'lucide-react';
import type { FilterState } from '../types';
import type { TranslationKey } from '../data/i18n';

interface FilterBarProps {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  teams: string[];
  groups: string[];
  t: (k: TranslationKey) => string;
  showFavouritesTab: boolean;
}

export function FilterBar({ filters, setFilters, teams, groups, t, showFavouritesTab }: FilterBarProps) {
  const hasActiveFilters = filters.team || filters.group || filters.date || filters.favouritesOnly || filters.search;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Free-text search */}
      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 focus-within:outline focus-within:outline-[var(--accent)]">
        <Search size={14} className="text-neutral-400 flex-shrink-0" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder={t('searchPlaceholder')}
          className="bg-transparent border-none outline-none focus:outline-none placeholder:text-neutral-400 w-28 sm:w-36"
        />
      </label>

      {/* Favourites toggle */}
      {showFavouritesTab && (
        <button
          onClick={() => setFilters({ ...filters, favouritesOnly: !filters.favouritesOnly })}
          className={[
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            filters.favouritesOnly
              ? 'bg-amber-400 text-amber-900'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-amber-50 dark:hover:bg-amber-900/20',
          ].join(' ')}
        >
          ★ {t('favourites')}
        </button>
      )}

      {/* Group filter */}
      <select
        value={filters.group}
        onChange={(e) => setFilters({ ...filters, group: e.target.value })}
        className="px-3 py-1.5 rounded-full text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-none outline-none focus:outline-[var(--accent)] cursor-pointer"
      >
        <option value="">{t('filterByGroup')}</option>
        {groups.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
        <option value="knockout">{t('knockout')}</option>
      </select>

      {/* Team filter */}
      <select
        value={filters.team}
        onChange={(e) => setFilters({ ...filters, team: e.target.value })}
        className="px-3 py-1.5 rounded-full text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-none outline-none focus:outline-[var(--accent)] cursor-pointer"
      >
        <option value="">{t('filterByTeam')}</option>
        {teams.map((team) => (
          <option key={team} value={team}>{team}</option>
        ))}
      </select>

      {/* Date filter */}
      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer">
        <span className="text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{t('filterByDate')}</span>
        <input
          type="date"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          className="bg-transparent border-none outline-none focus:outline-none text-neutral-700 dark:text-neutral-300 cursor-pointer"
          style={{ colorScheme: 'auto' }}
        />
      </label>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={() => setFilters({ team: '', group: '', date: '', favouritesOnly: false, search: '' })}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 bg-neutral-100 dark:bg-neutral-800"
        >
          <X size={12} />
          {t('clearFilters')}
        </button>
      )}
    </div>
  );
}
