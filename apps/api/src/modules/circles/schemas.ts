import { z } from '@hono/zod-openapi';
import { MAX_CAPACITY, MAX_WEEKS, MIN_CAPACITY, MIN_WEEKS } from '@krug/domain';

export const Locale = z.enum(['hy', 'ru', 'en']).openapi('Locale');
const Time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm')
  .openapi({ example: '19:30' });
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .openapi({ example: '2026-11-12' });

export const CreateCircleBody = z
  .object({
    title: z.string().trim().min(1).max(80).openapi({ example: 'Настолки по четвергам' }),
    activity: z.string().trim().min(1).max(60).openapi({ example: 'board games' }),
    language: Locale,
    weekday: z
      .number()
      .int()
      .min(1)
      .max(7)
      .openapi({ description: 'ISO weekday, 1 = Monday', example: 4 }),
    startTime: Time,
    weeks: z.number().int().min(MIN_WEEKS).max(MAX_WEEKS).default(8),
    capacity: z
      .number()
      .int()
      .min(MIN_CAPACITY)
      .max(MAX_CAPACITY)
      .default(8)
      .openapi({ description: 'Total people in the circle, organizer included' }),
    venueText: z.string().trim().max(200).optional(),
    startDate: IsoDate.optional().openapi({
      description: 'Earliest start date in the circle time zone; default today',
    }),
    chatLink: z
      .url({ protocol: /^https$/ })
      .max(300)
      .optional()
      .openapi({ description: 'Group chat link shown to members' }),
  })
  .openapi('CreateCircleBody');
export type CreateCircleInput = z.infer<typeof CreateCircleBody>;

export const Meeting = z
  .object({
    id: z.string(),
    index: z.number().int(),
    startsAt: z.string().openapi({ description: 'UTC, ISO 8601' }),
    status: z.enum(['scheduled', 'cancelled', 'done']),
  })
  .openapi('Meeting');

export const Circle = z
  .object({
    id: z.string(),
    title: z.string(),
    activity: z.string(),
    language: Locale,
    city: z.string(),
    timeZone: z.string(),
    weekday: z.number().int(),
    startTime: z.string(),
    weeks: z.number().int(),
    capacity: z.number().int(),
    status: z.enum(['draft', 'recruiting', 'active', 'finished', 'cancelled']),
    venueText: z.string().nullable(),
  })
  .openapi('Circle');

export const Member = z
  .object({
    userId: z.string(),
    name: z.string(),
    role: z.enum(['organizer', 'co_host', 'member']),
  })
  .openapi('Member');

export const MyMembership = z
  .object({
    role: z.enum(['organizer', 'co_host', 'member']),
    status: z.enum(['joined', 'waitlisted', 'left', 'removed']),
  })
  .openapi('MyMembership');

export const CircleDetail = z
  .object({
    circle: Circle,
    meetings: z.array(Meeting),
    members: z.array(Member).openapi({ description: 'Joined people only; names, never contacts' }),
    me: MyMembership,
    spotsLeft: z.number().int(),
    waitlistCount: z.number().int(),
    chatLink: z.string().nullable(),
    invite: z
      .object({ code: z.string(), url: z.string() })
      .nullable()
      .openapi({ description: 'Only for the organizer' }),
  })
  .openapi('CircleDetail');

export const InvitePreview = z
  .object({
    circleId: z
      .string()
      .nullable()
      .openapi({ description: 'Only when the viewer is already in the circle' }),
    myStatus: z
      .enum(['joined', 'waitlisted'])
      .nullable()
      .openapi({ description: "The signed-in viewer's place in this circle, if any" }),
    title: z.string(),
    activity: z.string(),
    language: Locale,
    weekday: z.number().int(),
    startTime: z.string(),
    timeZone: z.string(),
    weeks: z.number().int(),
    venueText: z.string().nullable(),
    firstMeetingAt: z.string().nullable(),
    spotsLeft: z.number().int(),
    organizerName: z.string().openapi({ description: 'First name only' }),
    open: z
      .boolean()
      .openapi({ description: 'Whether people can still join (or join the waitlist)' }),
  })
  .openapi('InvitePreview');

export const JoinResult = z
  .object({ circleId: z.string(), status: z.enum(['joined', 'waitlisted']) })
  .openapi('JoinResult');
