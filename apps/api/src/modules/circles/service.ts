import { and, asc, count, eq, inArray, or } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { blocks, circles, meetings, memberships, users, type Db } from '@krug/db';
import { createInviteCode, generateSchedule, placeNewMember, type IsoWeekday } from '@krug/domain';
import { ApiError, forbidden, notFound } from '../../errors';
import type { CreateCircleInput } from './schemas';

const DEFAULT_TIME_ZONE = 'Asia/Yerevan';
const OPEN_STATUSES = ['recruiting', 'active'] as const;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
const isUniqueViolation = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === '23505';

export async function createCircle(
  db: Db,
  organizerId: string,
  input: CreateCircleInput,
  now = new Date(),
) {
  const timeZone = DEFAULT_TIME_ZONE;
  const startDate = input.startDate ?? DateTime.fromJSDate(now, { zone: timeZone }).toISODate()!;
  const schedule = generateSchedule({
    startDate,
    weekday: input.weekday as IsoWeekday,
    time: input.startTime,
    weeks: input.weeks,
    timeZone,
  });

  // An invite-code collision is astronomically rare, but retrying costs nothing.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [circle] = await tx
          .insert(circles)
          .values({
            organizerId,
            title: input.title,
            activity: input.activity,
            language: input.language,
            timeZone,
            weekday: input.weekday,
            startTime: input.startTime,
            weeks: input.weeks,
            capacity: input.capacity,
            venueText: input.venueText ?? null,
            chatLink: input.chatLink ?? null,
            inviteCode: createInviteCode(),
          })
          .returning();
        await tx.insert(memberships).values({
          circleId: circle!.id,
          userId: organizerId,
          role: 'organizer',
          status: 'joined',
        });
        await tx.insert(meetings).values(
          schedule.map((m) => ({
            circleId: circle!.id,
            index: m.index,
            startsAt: new Date(m.startsAt),
          })),
        );
        return circle!.id;
      });
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 4) throw e;
    }
  }
  throw new Error('unreachable');
}

async function countByStatus(db: Db | Tx, circleId: string) {
  const rows = await db
    .select({ status: memberships.status, n: count() })
    .from(memberships)
    .where(eq(memberships.circleId, circleId))
    .groupBy(memberships.status);
  const get = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  return { joined: get('joined'), waitlisted: get('waitlisted') };
}

export async function getCircleDetail(db: Db, circleId: string, userId: string, appUrl: string) {
  const [row] = await db
    .select({ circle: circles, me: memberships })
    .from(circles)
    .innerJoin(
      memberships,
      and(eq(memberships.circleId, circles.id), eq(memberships.userId, userId)),
    )
    .where(and(eq(circles.id, circleId), inArray(memberships.status, ['joined', 'waitlisted'])));
  // Outsiders get "not found", so circle ids reveal nothing.
  if (!row) throw notFound('Circle');
  const { circle, me } = row;

  const [meetingRows, memberRows, counts] = await Promise.all([
    db.select().from(meetings).where(eq(meetings.circleId, circle.id)).orderBy(asc(meetings.index)),
    db
      .select({ userId: users.id, name: users.name, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.circleId, circle.id), eq(memberships.status, 'joined')))
      .orderBy(asc(memberships.createdAt)),
    countByStatus(db, circle.id),
  ]);

  const isOrganizer = me.role === 'organizer';
  return {
    circle: {
      id: circle.id,
      title: circle.title,
      activity: circle.activity,
      language: circle.language,
      city: circle.city,
      timeZone: circle.timeZone,
      weekday: circle.weekday,
      startTime: circle.startTime,
      weeks: circle.weeks,
      capacity: circle.capacity,
      status: circle.status,
      venueText: circle.venueText,
    },
    meetings: meetingRows.map((m) => ({
      id: m.id,
      index: m.index,
      startsAt: m.startsAt.toISOString(),
      status: m.status,
    })),
    members: memberRows,
    me: { role: me.role, status: me.status },
    spotsLeft: Math.max(0, circle.capacity - counts.joined),
    waitlistCount: counts.waitlisted,
    chatLink: me.status === 'joined' ? circle.chatLink : null,
    invite: isOrganizer
      ? { code: circle.inviteCode, url: `${appUrl}/i/${circle.inviteCode}` }
      : null,
  };
}

export async function getInvitePreview(db: Db, code: string, viewerId?: string) {
  const [row] = await db
    .select({ circle: circles, organizerName: users.name })
    .from(circles)
    .innerJoin(users, eq(users.id, circles.organizerId))
    .where(eq(circles.inviteCode, code));
  if (!row) throw notFound('Invite');
  const { circle } = row;
  const [first] = await db
    .select({ startsAt: meetings.startsAt })
    .from(meetings)
    .where(and(eq(meetings.circleId, circle.id), eq(meetings.status, 'scheduled')))
    .orderBy(asc(meetings.startsAt))
    .limit(1);
  const counts = await countByStatus(db, circle.id);
  let myStatus: 'joined' | 'waitlisted' | null = null;
  if (viewerId) {
    const [m] = await db
      .select({ status: memberships.status })
      .from(memberships)
      .where(and(eq(memberships.circleId, circle.id), eq(memberships.userId, viewerId)));
    if (m?.status === 'joined' || m?.status === 'waitlisted') myStatus = m.status;
  }
  return {
    circleId: myStatus ? circle.id : null,
    myStatus,
    title: circle.title,
    activity: circle.activity,
    language: circle.language,
    weekday: circle.weekday,
    startTime: circle.startTime,
    timeZone: circle.timeZone,
    weeks: circle.weeks,
    venueText: circle.venueText,
    firstMeetingAt: first?.startsAt.toISOString() ?? null,
    spotsLeft: Math.max(0, circle.capacity - counts.joined),
    organizerName: firstName(row.organizerName),
    open: (OPEN_STATUSES as readonly string[]).includes(circle.status),
  };
}

export async function joinByInvite(db: Db, code: string, userId: string) {
  return db.transaction(async (tx) => {
    // Lock the circle row so two people pressing "join" at once cannot both take the last spot.
    const [circle] = await tx
      .select()
      .from(circles)
      .where(eq(circles.inviteCode, code))
      .for('update');
    if (!circle) throw notFound('Invite');
    if (!(OPEN_STATUSES as readonly string[]).includes(circle.status)) {
      throw new ApiError(409, 'conflict', 'This circle is no longer accepting people');
    }

    const [blocked] = await tx
      .select({ a: blocks.blockerId })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, circle.organizerId), eq(blocks.blockedId, userId)),
          and(eq(blocks.blockerId, userId), eq(blocks.blockedId, circle.organizerId)),
        ),
      )
      .limit(1);
    if (blocked) throw forbidden("You can't join this circle");

    const [existing] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.circleId, circle.id), eq(memberships.userId, userId)));
    if (existing?.status === 'joined' || existing?.status === 'waitlisted') {
      return { circleId: circle.id, status: existing.status }; // idempotent: pressing twice is harmless
    }
    if (existing?.status === 'removed') throw forbidden("You can't join this circle");

    const { joined } = await countByStatus(tx, circle.id);
    const status = placeNewMember(joined, circle.capacity);
    if (existing) {
      await tx
        .update(memberships)
        .set({ status, role: 'member' })
        .where(eq(memberships.id, existing.id));
    } else {
      await tx.insert(memberships).values({ circleId: circle.id, userId, role: 'member', status });
    }
    return { circleId: circle.id, status };
  });
}

export async function leaveCircle(db: Db, circleId: string, userId: string) {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.circleId, circleId), eq(memberships.userId, userId)));
  if (!m || (m.status !== 'joined' && m.status !== 'waitlisted')) throw notFound('Circle');
  if (m.role === 'organizer')
    throw new ApiError(409, 'conflict', 'The organizer cannot leave; hand the circle over first');
  await db.update(memberships).set({ status: 'left' }).where(eq(memberships.id, m.id));
  // Offering the freed spot to the waitlist is step 1.6 (worker job with a 24 h offer).
}
