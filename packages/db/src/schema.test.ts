import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testing';
import { circles, memberships, notifications, users } from './schema';
import type { Db } from './client';

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

async function makeUser(name = 'Ani') {
  const [u] = await db.insert(users).values({ name }).returning();
  return u!;
}

const circleValues = (organizerId: string, inviteCode: string) => ({
  organizerId,
  title: 'Board games',
  activity: 'board games',
  language: 'hy' as const,
  weekday: 4,
  startTime: '19:30',
  weeks: 8,
  capacity: 8,
  inviteCode,
});

describe('schema', () => {
  it('applies migrations and generates ids and defaults', async () => {
    const u = await makeUser();
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.locale).toBe('hy');
    const [c] = await db.insert(circles).values(circleValues(u.id, 'ABCDEFGH12')).returning();
    expect(c!.timeZone).toBe('Asia/Yerevan');
    expect(c!.status).toBe('recruiting');
  });

  it('rejects out-of-range circles at the database level', async () => {
    const u = await makeUser();
    await expect(
      db.insert(circles).values({ ...circleValues(u.id, 'BADWEEKDAY'), weekday: 8 }),
    ).rejects.toThrow();
    await expect(
      db.insert(circles).values({ ...circleValues(u.id, 'BADTIME000'), startTime: '25:00' }),
    ).rejects.toThrow();
    await expect(
      db.insert(circles).values({ ...circleValues(u.id, 'BADCAP0000'), capacity: 2 }),
    ).rejects.toThrow();
  });

  it('allows one membership per person per circle', async () => {
    const u = await makeUser();
    const [c] = await db.insert(circles).values(circleValues(u.id, 'UNIQUEMEM1')).returning();
    await db.insert(memberships).values({ circleId: c!.id, userId: u.id, status: 'joined' });
    await expect(
      db.insert(memberships).values({ circleId: c!.id, userId: u.id, status: 'joined' }),
    ).rejects.toThrow();
  });

  it('never stores the same notification twice', async () => {
    const u = await makeUser();
    const row = {
      userId: u.id,
      channel: 'telegram' as const,
      template: 'reminder_24h',
      dedupeKey: 'meeting-1:user-1:24h',
      scheduledFor: new Date(),
    };
    await db.insert(notifications).values(row);
    await db.insert(notifications).values(row).onConflictDoNothing();
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.dedupeKey, row.dedupeKey));
    expect(rows).toHaveLength(1);
  });
});
