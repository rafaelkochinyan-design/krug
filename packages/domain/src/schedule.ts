import { DateTime } from 'luxon';
import { MAX_WEEKS, MIN_WEEKS } from './limits';

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ScheduleInput {
  /** First calendar day the season may start on, `YYYY-MM-DD`, in the circle's time zone. */
  startDate: string;
  weekday: IsoWeekday;
  /** Local wall-clock time of every meeting, `HH:mm`. */
  time: string;
  /** Number of weekly meetings in the season. */
  weeks: number;
  /** IANA time zone of the circle, e.g. `Asia/Yerevan`. */
  timeZone: string;
}

export interface ScheduledMeeting {
  /** 1-based position in the season. */
  index: number;
  /** Start instant in UTC, ISO 8601. */
  startsAt: string;
  /** Local date `YYYY-MM-DD` in the circle's time zone (what people see). */
  localDate: string;
}

/**
 * Builds the weekly meetings of one season.
 * The first meeting is the first `weekday` on or after `startDate`; every meeting keeps the same
 * local wall-clock time, so a daylight-saving change never shifts it by an hour.
 */
export function generateSchedule(input: ScheduleInput): ScheduledMeeting[] {
  const { startDate, weekday, time, weeks, timeZone } = input;
  if (!Number.isInteger(weeks) || weeks < MIN_WEEKS || weeks > MAX_WEEKS) {
    throw new RangeError(`weeks must be an integer between ${MIN_WEEKS} and ${MAX_WEEKS}`);
  }
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  if (!match || hour > 23 || minute > 59) throw new RangeError('time must be HH:mm');

  const start = DateTime.fromISO(startDate, { zone: timeZone });
  if (!start.isValid)
    throw new RangeError(`invalid startDate or timeZone: ${start.invalidExplanation}`);

  const offset = (weekday - start.weekday + 7) % 7;
  const first = start.plus({ days: offset }).set({ hour, minute, second: 0, millisecond: 0 });

  return Array.from({ length: weeks }, (_, i) => {
    const local = first.plus({ weeks: i }).set({ hour, minute });
    return {
      index: i + 1,
      startsAt: local.toUTC().toISO({ suppressMilliseconds: true }) ?? '',
      localDate: local.toISODate() ?? '',
    };
  });
}

export { MAX_WEEKS, MIN_WEEKS };
