import { toZonedTime, format as tzFormat } from 'date-fns-tz';
import { enUS, fr, es, de } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const localeMap: Record<string, Locale> = {
  en: enUS,
  fr,
  es,
  de,
};

function getLocale(language: string): Locale {
  const short = language.split('-')[0].toLowerCase();
  return localeMap[short] ?? enUS;
}

export function formatMatchTime(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zoned = toZonedTime(d, timezone);
  return tzFormat(zoned, 'HH:mm', { timeZone: timezone });
}

export function formatMatchDate(
  date: Date | string,
  timezone: string,
  language = 'en',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zoned = toZonedTime(d, timezone);
  return tzFormat(zoned, 'EEEE d MMMM', { timeZone: timezone, locale: getLocale(language) });
}

export function getDateKey(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zoned = toZonedTime(d, timezone);
  return tzFormat(zoned, 'yyyy-MM-dd', { timeZone: timezone });
}

export function isMatchToday(date: Date | string, timezone: string): boolean {
  const todayKey = getDateKey(new Date(), timezone);
  return getDateKey(date, timezone) === todayKey;
}

export function isMatchTomorrow(date: Date | string, timezone: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getDateKey(tomorrow, timezone);
  return getDateKey(date, timezone) === tomorrowKey;
}

/** Returns seconds until the given UTC date from now. Negative if in the past. */
export function secondsUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return (d.getTime() - Date.now()) / 1000;
}

/** Format a duration in seconds as "Xh Ym" or "Zm" */
export function formatCountdown(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes <= 0) return '';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
