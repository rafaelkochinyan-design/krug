import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const id = () =>
  text()
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const localeEnum = pgEnum('locale', ['hy', 'ru', 'en']);
export const circleStatusEnum = pgEnum('circle_status', [
  'draft',
  'recruiting',
  'active',
  'finished',
  'cancelled',
]);
export const visibilityEnum = pgEnum('visibility', ['private', 'public']);
export const memberRoleEnum = pgEnum('member_role', ['organizer', 'co_host', 'member']);
export const membershipStatusEnum = pgEnum('membership_status', [
  'joined',
  'waitlisted',
  'left',
  'removed',
]);
export const meetingStatusEnum = pgEnum('meeting_status', ['scheduled', 'cancelled', 'done']);
export const rsvpEnum = pgEnum('rsvp', ['yes', 'no', 'maybe']);
export const channelEnum = pgEnum('notification_channel', ['telegram', 'email', 'push']);
export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'cancelled',
]);
export const reportStatusEnum = pgEnum('report_status', ['open', 'resolved', 'dismissed']);

/**
 * People. Shape is compatible with Better Auth's `user` model (added in step 0.7),
 * plus our own fields. Personal data is wiped on account deletion; `deletedAt` keeps stats intact.
 */
export const users = pgTable('users', {
  id: id(),
  name: text().notNull(),
  email: text().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  locale: localeEnum().notNull().default('hy'),
  city: text(),
  adultConfirmedAt: timestamp({ withTimezone: true }),
  telegramChatId: text().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp({ withTimezone: true }),
});

export const venues = pgTable('venues', {
  id: id(),
  name: text().notNull(),
  address: text(),
  city: text().notNull().default('Yerevan'),
  latitude: text(),
  longitude: text(),
  isPartner: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One circle = one season of weekly meetings with the same people. */
export const circles = pgTable(
  'circles',
  {
    id: id(),
    organizerId: text()
      .notNull()
      .references(() => users.id),
    previousCircleId: text(),
    title: text().notNull(),
    activity: text().notNull(),
    language: localeEnum().notNull(),
    city: text().notNull().default('Yerevan'),
    timeZone: text().notNull().default('Asia/Yerevan'),
    venueId: text().references(() => venues.id),
    venueText: text(),
    weekday: smallint().notNull(),
    startTime: text().notNull(),
    weeks: smallint().notNull(),
    capacity: smallint().notNull(),
    status: circleStatusEnum().notNull().default('recruiting'),
    visibility: visibilityEnum().notNull().default('private'),
    inviteCode: text().notNull().unique(),
    chatLink: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('circles_weekday_range', sql`${t.weekday} between 1 and 7`),
    check('circles_weeks_range', sql`${t.weeks} between 1 and 16`),
    check('circles_capacity_range', sql`${t.capacity} between 3 and 20`),
    check('circles_start_time_format', sql`${t.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    index('circles_organizer_idx').on(t.organizerId),
  ],
);

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    circleId: text()
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id),
    role: memberRoleEnum().notNull().default('member'),
    status: membershipStatusEnum().notNull(),
    /** When a freed spot was offered to this waitlisted person, and until when they can accept. */
    offeredAt: timestamp({ withTimezone: true }),
    offerExpiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('memberships_circle_user_uq').on(t.circleId, t.userId),
    index('memberships_circle_status_idx').on(t.circleId, t.status, t.createdAt),
  ],
);

/** Called "meetings" (not "sessions") so it never clashes with auth sessions. */
export const meetings = pgTable(
  'meetings',
  {
    id: id(),
    circleId: text()
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    index: smallint().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    venueText: text(),
    status: meetingStatusEnum().notNull().default('scheduled'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('meetings_circle_index_uq').on(t.circleId, t.index),
    index('meetings_starts_at_idx').on(t.startsAt),
  ],
);

export const attendance = pgTable(
  'attendance',
  {
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id),
    rsvp: rsvpEnum(),
    respondedAt: timestamp({ withTimezone: true }),
    attended: boolean(),
    markedAt: timestamp({ withTimezone: true }),
    markedBy: text().references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.meetingId, t.userId] })],
);

/** Outbox of messages; `dedupeKey` guarantees a reminder is never sent twice. */
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id),
    channel: channelEnum().notNull(),
    template: text().notNull(),
    payload: jsonb().notNull().default({}),
    dedupeKey: text().notNull().unique(),
    scheduledFor: timestamp({ withTimezone: true }).notNull(),
    status: notificationStatusEnum().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    lastError: text(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_due_idx').on(t.status, t.scheduledFor)],
);

export const reports = pgTable('reports', {
  id: id(),
  reporterId: text()
    .notNull()
    .references(() => users.id),
  targetUserId: text().references(() => users.id),
  targetCircleId: text().references(() => circles.id),
  reason: text().notNull(),
  details: text(),
  status: reportStatusEnum().notNull().default('open'),
  resolvedBy: text().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const blocks = pgTable(
  'blocks',
  {
    blockerId: text()
      .notNull()
      .references(() => users.id),
    blockedId: text()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: text(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text().notNull(),
    data: jsonb().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_entity_idx').on(t.entity, t.entityId)],
);
