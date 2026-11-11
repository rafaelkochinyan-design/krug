import type { Locale } from '@krug/i18n';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof KEYS)[number];

/** Translation key suffix for an ISO weekday (1 = Monday): t(`weekday.${weekdayKey(n)}`). */
export function weekdayKey(n: number): WeekdayKey {
  const key = KEYS[n - 1];
  if (!key || !Number.isInteger(n)) throw new RangeError(`Not an ISO weekday: ${n}`);
  return key;
}

/** A meeting time shown in the circle's own time zone, whatever the viewer's device zone is. */
export function formatMeeting(iso: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}
