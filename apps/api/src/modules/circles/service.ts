import { and, asc, count, eq, inArray, or } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  blocks,
  circles,
  type circleStatusEnum,
  meetings,
  memberships,
  users,
  type Db,
} from '@krug/db';
import {
  canJoin,
  canLeave,
  canSeeChatLink,
  canSeeInvite,
  createInviteCode,
  firstName,
  generateSchedule,
  isCircleOpen,
  placeNewMember,
  toCircleMember,
  type CircleStatus,
  type IsoWeekday,
  type ViewerMembership,
} from '@krug/domain';
import { ApiError, forbidden, notFound } from '../../errors';
import type { CreateCircleInput } from './schemas';

// Compile-time guard: if the DB circle_status enum and the domain CircleStatus union ever
// diverge, these two identity functions fail to compile (the return type won't match).
// They are intentionally unused at runtime — disable the unused-var lint rule for them.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _dbToCircleStatus = (_: (typeof circleStatusEnum.enumValues)[number]): CircleStatus => _;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _circleToDbStatus = (_: CircleStatus): (typeof circleStatusEnum.enumValues)[number] => _;

const DEFAULT_TIME_ZONE = 'Asia/Yerevan';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

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

  const meMs: ViewerMembership = { role: me.role, status: me.status };
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
    members: memberRows.map(toCircleMember),
    me: { role: me.role, status: me.status },
    spotsLeft: Math.max(0, circle.capacity - counts.joined),
    waitlistCount: counts.waitlisted,
    chatLink: canSeeChatLink(meMs) ? circle.chatLink : null,
    invite: canSeeInvite(meMs)
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
    open: isCircleOpen(circle.status),
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

    const [existing] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.circleId, circle.id), eq(memberships.userId, userId)));

    const membership: ViewerMembership | null = existing
      ? { role: existing.role, status: existing.status }
      : null;

    // isAdult is not enforced until PR10; requireAdult defaults to false
    const joinResult = canJoin({
      viewer: { userId, isAdult: false },
      circleStatus: circle.status,
      membership,
      blocked: !!blocked,
    });

    if (!joinResult.allowed) {
      if (joinResult.reason === 'not_open') {
        throw new ApiError(409, 'conflict', 'This circle is no longer accepting people');
      }
      // blocked, removed, not_adult → 403
      throw forbidden("You can't join this circle");
    }

    if (joinResult.alreadyMember) {
      // idempotent: pressing twice is harmless
      // existingStatus is provided by canJoin when alreadyMember is true
      return { circleId: circle.id, status: joinResult.existingStatus };
    }

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

  const membership: ViewerMembership | null = m ? { role: m.role, status: m.status } : null;

  const result = canLeave(membership);
  if (!result.allowed) {
    if (result.reason === 'organizer') {
      throw new ApiError(409, 'conflict', 'The organizer cannot leave; hand the circle over first');
    }
    // not_member → 404
    throw notFound('Circle');
  }

  // canLeave returned {allowed:true} → m is non-null and status is joined or waitlisted.
  // Filter by (circleId, userId) to avoid the non-null assertion on m.id.
  await db
    .update(memberships)
    .set({ status: 'left' })
    .where(and(eq(memberships.circleId, circleId), eq(memberships.userId, userId)));
  // Offering the freed spot to the waitlist is step 1.6 (worker job with a 24 h offer).
}
