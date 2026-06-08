
import { Download } from 'lucide-react';
import type { Match, UserPreferences } from '../types';
import { getChannelsForCountry } from '../data/tvChannels';
import type { TranslationKey } from '../data/i18n';

interface ICSExportProps {
  matches: Match[];
  prefs: UserPreferences;
  t: (k: TranslationKey) => string;
}

function pad(n: number, len = 2) {
  return String(n).padStart(len, '0');
}

function toICSDate(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    '00Z'
  );
}

function generateICS(matches: Match[], prefs: UserPreferences): string {
  const channels = getChannelsForCountry(prefs.countryCode);
  const channelStr = channels.length > 0 ? channels.join(', ') : 'Check local listings';

  const events = matches.map((m) => {
    const start = toICSDate(m.utcDate);
    const end = toICSDate(new Date(m.utcDate.getTime() + 2 * 60 * 60 * 1000)); // +2h
    const title = `${m.team1} vs ${m.team2}`;
    const desc = [
      `World Cup 2026 - ${m.round}`,
      m.group ? `Group: ${m.group}` : '',
      `Venue: ${m.venue}`,
      `Watch on: ${channelStr}`,
    ].filter(Boolean).join('\\n');

    return [
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${m.venue}`,
      `UID:wc2026-${m.id}@wc2026`,
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//World Cup 2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:World Cup 2026',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function ICSExport({ matches, prefs, t }: ICSExportProps) {
  const favMatches = matches.filter((m) => prefs.favouriteMatches.includes(m.id));

  const download = (subset: Match[], filename: string) => {
    const ics = generateICS(subset, prefs);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => download(matches, 'wc2026-all.ics')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
      >
        <Download size={14} />
        {t('exportAll')}
      </button>
      {favMatches.length > 0 && (
        <button
          onClick={() => download(favMatches, 'wc2026-favourites.ics')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 transition-colors"
        >
          <Download size={14} />
          {t('exportFavourites')}
        </button>
      )}
    </div>
  );
}
