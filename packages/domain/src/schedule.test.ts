import { describe, expect, it } from 'vitest';
import { generateSchedule } from './schedule';

describe('generateSchedule', () => {
  it('starts on the first matching weekday and repeats weekly at the same local time (Yerevan, UTC+4)', () => {
    // 2026-11-10 is a Tuesday; ask for Thursdays at 19:30.
    const s = generateSchedule({
      startDate: '2026-11-10',
      weekday: 4,
      time: '19:30',
      weeks: 3,
      timeZone: 'Asia/Yerevan',
    });
    expect(s).toEqual([
      { index: 1, startsAt: '2026-11-12T15:30:00Z', localDate: '2026-11-12' },
      { index: 2, startsAt: '2026-11-19T15:30:00Z', localDate: '2026-11-19' },
      { index: 3, startsAt: '2026-11-26T15:30:00Z', localDate: '2026-11-26' },
    ]);
  });

  it('uses the start date itself when it already is the weekday', () => {
    const s = generateSchedule({
      startDate: '2026-11-12',
      weekday: 4,
      time: '10:00',
      weeks: 1,
      timeZone: 'Asia/Yerevan',
    });
    expect(s[0]?.localDate).toBe('2026-11-12');
  });

  it('keeps the local wall-clock time across a daylight-saving change', () => {
    // Berlin switches to winter time on 2026-10-25.
    const s = generateSchedule({
      startDate: '2026-10-19',
      weekday: 1,
      time: '19:00',
      weeks: 2,
      timeZone: 'Europe/Berlin',
    });
    expect(s.map((m) => m.startsAt)).toEqual(['2026-10-19T17:00:00Z', '2026-10-26T18:00:00Z']);
  });

  it('crosses a year boundary', () => {
    const s = generateSchedule({
      startDate: '2026-12-28',
      weekday: 1,
      time: '18:00',
      weeks: 2,
      timeZone: 'Asia/Yerevan',
    });
    expect(s.map((m) => m.localDate)).toEqual(['2026-12-28', '2027-01-04']);
  });

  it.each([0, 17, 2.5])('rejects %s weeks', (weeks) => {
    expect(() =>
      generateSchedule({
        startDate: '2026-11-10',
        weekday: 1,
        time: '18:00',
        weeks,
        timeZone: 'Asia/Yerevan',
      }),
    ).toThrow(RangeError);
  });

  it.each(['24:00', '7:30', '19:60', 'abc'])('rejects time %s', (time) => {
    expect(() =>
      generateSchedule({
        startDate: '2026-11-10',
        weekday: 1,
        time,
        weeks: 1,
        timeZone: 'Asia/Yerevan',
      }),
    ).toThrow(RangeError);
  });

  it('rejects an unknown time zone', () => {
    expect(() =>
      generateSchedule({
        startDate: '2026-11-10',
        weekday: 1,
        time: '18:00',
        weeks: 1,
        timeZone: 'Mars/Olympus',
      }),
    ).toThrow(RangeError);
  });
});
