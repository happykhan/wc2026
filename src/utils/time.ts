import { toZonedTime, format as tzFormat } from 'date-fns-tz';

export function formatMatchTime(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zoned = toZonedTime(d, timezone);
  return tzFormat(zoned, 'HH:mm', { timeZone: timezone });
}

export function formatMatchDate(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zoned = toZonedTime(d, timezone);
  return tzFormat(zoned, 'EEEE d MMMM', { timeZone: timezone });
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
