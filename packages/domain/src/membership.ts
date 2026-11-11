import { MAX_CAPACITY, MIN_CAPACITY } from './limits';

export type MembershipStatus = 'joined' | 'waitlisted' | 'left' | 'removed';

/** Decides where a new member lands, given how many people are already in the circle. */
export function placeNewMember(activeMembers: number, capacity: number): 'joined' | 'waitlisted' {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be >= 1');
  return activeMembers < capacity ? 'joined' : 'waitlisted';
}

/**
 * Returns the 1-based waitlist position for the given user, or null if they are not on the list.
 * @param orderedWaitlistUserIds - User IDs in waitlist order (earliest-joined first).
 */
export function waitlistPosition(orderedWaitlistUserIds: string[], userId: string): number | null {
  const index = orderedWaitlistUserIds.indexOf(userId);
  return index === -1 ? null : index + 1;
}

export interface SeasonProgressInput {
  /** UTC ISO strings, any order. */
  meetingStartsAt: string[];
  /** Total number of weeks in the season (matches the circle's `weeks` field). */
  weeks: number;
  now: Date;
}

export interface SeasonProgress {
  phase: 'upcoming' | 'running' | 'finished';
  /**
   * Current week number, 1-based.
   * Equals the count of meetings with startsAt ≤ now, clamped to [1, weeks].
   * Always 1 when upcoming; always equals `of` when finished.
   */
  week: number;
  /** Total weeks in the season. */
  of: number;
  /**
   * Days until the first meeting starts, as a count of full 24-hour blocks
   * (ceiling-rounded). Note: this is wall-clock milliseconds divided by 86 400 000,
   * not calendar days in the circle's local time zone — the caller must adjust if needed.
   * Set only when phase is 'upcoming'; null in running and finished phases.
   */
  daysUntilStart: number | null;
}

/**
 * Returns the season phase, current week number, and optionally how many days until it starts.
 *
 * - **upcoming**: no meetings have started yet (startsAt > now for all)
 * - **running**: at least one meeting has started and now ≤ last meeting's startsAt
 * - **finished**: now > last meeting's startsAt
 */
export function seasonProgress(input: SeasonProgressInput): SeasonProgress {
  const { meetingStartsAt, weeks, now } = input;
  const of = weeks;
  const nowMs = now.getTime();

  const sortedMs = [...meetingStartsAt]
    .map((s) => {
      const ms = new Date(s).getTime();
      if (isNaN(ms)) throw new RangeError(`Invalid ISO date string: "${s}"`);
      return ms;
    })
    .sort((a, b) => a - b);

  const started = sortedMs.filter((ms) => ms <= nowMs).length;

  if (started === 0) {
    const firstMs = sortedMs[0] ?? null;
    const daysUntilStart =
      firstMs != null ? Math.ceil((firstMs - nowMs) / (1000 * 60 * 60 * 24)) : null;
    return { phase: 'upcoming', week: 1, of, daysUntilStart };
  }

  const lastMs = sortedMs[sortedMs.length - 1] ?? null;
  if (lastMs != null && nowMs > lastMs) {
    return { phase: 'finished', week: of, of, daysUntilStart: null };
  }

  const week = Math.min(Math.max(started, 1), of);
  return { phase: 'running', week, of, daysUntilStart: null };
}

export interface MeetingForSchedule {
  index: number;
  startsAt: string;
  status: 'scheduled' | 'cancelled' | 'done';
}

/**
 * Returns the index of the next meeting that is still scheduled (status='scheduled')
 * and has not yet started (startsAt > now), or null if none remain.
 */
export function nextScheduledIndex(meetings: MeetingForSchedule[], now: Date): number | null {
  const nowMs = now.getTime();
  const upcoming = meetings
    .filter((m) => m.status === 'scheduled' && new Date(m.startsAt).getTime() > nowMs)
    .sort((a, b) => {
      // Primary: soonest startsAt first. Tie-break: lower index first.
      const timeDiff = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      return timeDiff !== 0 ? timeDiff : a.index - b.index;
    });
  return upcoming[0]?.index ?? null;
}

export { MAX_CAPACITY, MIN_CAPACITY };
