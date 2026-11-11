import { describe, expect, it } from 'vitest';
import { nextScheduledIndex, placeNewMember, seasonProgress, waitlistPosition } from './membership';
import { createInviteCode, isInviteCode, INVITE_CODE_LENGTH } from './invite';

describe('placeNewMember', () => {
  it('joins while there is room and waitlists once full', () => {
    expect(placeNewMember(7, 8)).toBe('joined');
    expect(placeNewMember(8, 8)).toBe('waitlisted');
    expect(placeNewMember(9, 8)).toBe('waitlisted');
  });
  it('rejects a capacity below 1', () => {
    expect(() => placeNewMember(0, 0)).toThrow(RangeError);
  });
});

describe('waitlistPosition', () => {
  it('returns null when the user is not on the waitlist', () => {
    expect(waitlistPosition(['u1', 'u2', 'u3'], 'u4')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(waitlistPosition([], 'u1')).toBeNull();
  });

  it('returns 1 for the first person on the waitlist', () => {
    expect(waitlistPosition(['u1', 'u2', 'u3'], 'u1')).toBe(1);
  });

  it('returns the correct 1-based position', () => {
    expect(waitlistPosition(['u1', 'u2', 'u3'], 'u3')).toBe(3);
    expect(waitlistPosition(['u1', 'u2', 'u3'], 'u2')).toBe(2);
  });
});

describe('seasonProgress', () => {
  // Helper: build a date N days from base
  const daysFrom = (base: Date, n: number) => new Date(base.getTime() + n * 86_400_000);
  const toIso = (d: Date) => d.toISOString();

  it('upcoming — no meetings started yet', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    const meetings = [
      toIso(daysFrom(now, 7)), // 7 days from now
      toIso(daysFrom(now, 14)),
      toIso(daysFrom(now, 21)),
    ];
    const result = seasonProgress({ meetingStartsAt: meetings, weeks: 3, now });
    expect(result.phase).toBe('upcoming');
    expect(result.week).toBe(1);
    expect(result.of).toBe(3);
    expect(result.daysUntilStart).toBe(7);
  });

  it('running mid-season — 2 of 4 meetings started', () => {
    const base = new Date('2026-11-01T12:00:00Z');
    const meetings = [
      toIso(daysFrom(base, -14)), // started 2 weeks ago
      toIso(daysFrom(base, -7)), // started 1 week ago
      toIso(daysFrom(base, 7)), // in future
      toIso(daysFrom(base, 14)), // in future
    ];
    const result = seasonProgress({ meetingStartsAt: meetings, weeks: 4, now: base });
    expect(result.phase).toBe('running');
    expect(result.week).toBe(2);
    expect(result.of).toBe(4);
    expect(result.daysUntilStart).toBeNull();
  });

  it('running last week — 7 of 8 meetings started', () => {
    const base = new Date('2026-11-01T12:00:00Z');
    // 7 meetings in the past, 1 meeting next week
    const meetings = [
      toIso(daysFrom(base, -7)),
      toIso(daysFrom(base, -6)),
      toIso(daysFrom(base, -5)),
      toIso(daysFrom(base, -4)),
      toIso(daysFrom(base, -3)),
      toIso(daysFrom(base, -2)),
      toIso(daysFrom(base, -1)),
      toIso(daysFrom(base, 7)), // not yet started
    ];
    const result = seasonProgress({ meetingStartsAt: meetings, weeks: 8, now: base });
    expect(result.phase).toBe('running');
    expect(result.week).toBe(7);
    expect(result.of).toBe(8);
  });

  it('finished — now is after the last meeting', () => {
    const base = new Date('2026-11-15T12:00:00Z');
    const meetings = [
      toIso(daysFrom(base, -21)),
      toIso(daysFrom(base, -14)),
      toIso(daysFrom(base, -7)),
      toIso(daysFrom(base, -1)), // last one ended yesterday
    ];
    const result = seasonProgress({ meetingStartsAt: meetings, weeks: 4, now: base });
    expect(result.phase).toBe('finished');
    expect(result.week).toBe(4); // equals of
    expect(result.of).toBe(4);
    expect(result.daysUntilStart).toBeNull();
  });

  it('handles unordered input correctly', () => {
    const base = new Date('2026-11-01T12:00:00Z');
    // Provide meetings out of order
    const meetings = [
      toIso(daysFrom(base, 14)), // future
      toIso(daysFrom(base, -14)), // past
      toIso(daysFrom(base, 7)), // future
      toIso(daysFrom(base, -7)), // past
    ];
    const result = seasonProgress({ meetingStartsAt: meetings, weeks: 4, now: base });
    expect(result.phase).toBe('running');
    expect(result.week).toBe(2);
  });

  it('weeks clamp — started count clamped to [1, of]', () => {
    const base = new Date('2026-11-15T12:00:00Z');
    // 5 meetings all started, but weeks=3
    const meetings = Array.from({ length: 5 }, (_, i) => toIso(daysFrom(base, -(i + 1) * 7)));
    const result = seasonProgress({ meetingStartsAt: meetings, weeks: 3, now: base });
    expect(result.phase).toBe('finished');
    expect(result.week).toBe(3); // clamped to of=3
    expect(result.of).toBe(3);
  });

  it('no meetings — upcoming with null daysUntilStart', () => {
    const result = seasonProgress({
      meetingStartsAt: [],
      weeks: 4,
      now: new Date('2026-11-01T12:00:00Z'),
    });
    expect(result.phase).toBe('upcoming');
    expect(result.daysUntilStart).toBeNull();
  });

  it('throws RangeError on an invalid ISO date string', () => {
    expect(() =>
      seasonProgress({
        meetingStartsAt: ['2026-11-01T12:00:00Z', 'not-a-date'],
        weeks: 2,
        now: new Date('2026-11-01T12:00:00Z'),
      }),
    ).toThrow(RangeError);
  });
});

describe('nextScheduledIndex', () => {
  const future = (offsetHours: number) =>
    new Date(Date.now() + offsetHours * 3_600_000).toISOString();
  const past = (offsetHours: number) =>
    new Date(Date.now() - offsetHours * 3_600_000).toISOString();

  it('returns null when no meetings remain', () => {
    expect(nextScheduledIndex([], new Date())).toBeNull();
  });

  it('returns null when all future meetings are cancelled or done', () => {
    const meetings = [
      { index: 1, startsAt: future(24), status: 'cancelled' as const },
      { index: 2, startsAt: future(48), status: 'done' as const },
    ];
    expect(nextScheduledIndex(meetings, new Date())).toBeNull();
  });

  it('returns null when all scheduled meetings are in the past', () => {
    const meetings = [
      { index: 1, startsAt: past(48), status: 'scheduled' as const },
      { index: 2, startsAt: past(24), status: 'scheduled' as const },
    ];
    expect(nextScheduledIndex(meetings, new Date())).toBeNull();
  });

  it('returns the index of the next scheduled future meeting', () => {
    const now = new Date();
    const meetings = [
      { index: 1, startsAt: past(24), status: 'done' as const },
      { index: 2, startsAt: past(1), status: 'scheduled' as const }, // past, not returned
      { index: 3, startsAt: future(24), status: 'scheduled' as const },
      { index: 4, startsAt: future(48), status: 'scheduled' as const },
    ];
    expect(nextScheduledIndex(meetings, now)).toBe(3);
  });

  it('skips cancelled and done meetings before returning the next scheduled one', () => {
    const now = new Date();
    const meetings = [
      { index: 1, startsAt: past(48), status: 'done' as const },
      { index: 2, startsAt: future(24), status: 'cancelled' as const },
      { index: 3, startsAt: future(48), status: 'done' as const },
      { index: 4, startsAt: future(72), status: 'scheduled' as const },
    ];
    expect(nextScheduledIndex(meetings, now)).toBe(4);
  });

  it('returns the meeting with the soonest startsAt even when index order differs', () => {
    // index 2 has a lower index but starts LATER; index 3 starts SOONER
    // The function must return index 3 (soonest startsAt), not index 2 (lowest index).
    const now = new Date();
    const meetings = [
      { index: 2, startsAt: future(48), status: 'scheduled' as const }, // later, lower index
      { index: 3, startsAt: future(24), status: 'scheduled' as const }, // sooner, higher index
    ];
    expect(nextScheduledIndex(meetings, now)).toBe(3);
  });
});

describe('invite codes', () => {
  it('produces readable codes of a fixed length', () => {
    for (let i = 0; i < 200; i++) {
      const code = createInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(isInviteCode(code)).toBe(true);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });
  it('rejects malformed codes', () => {
    expect(isInviteCode('abc')).toBe(false);
    expect(isInviteCode('OOOOOOOOOO')).toBe(false);
  });
});
