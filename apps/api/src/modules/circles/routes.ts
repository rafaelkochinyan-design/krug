import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { isInviteCode } from '@krug/domain';
import { authRequired, requireUser } from '../../auth';
import type { AppEnv } from '../../context';
import { ErrorBody, notFound } from '../../errors';
import { CircleDetail, CreateCircleBody, InvitePreview, JoinResult } from './schemas';
import {
  createCircle,
  getCircleDetail,
  getInvitePreview,
  joinByInvite,
  leaveCircle,
} from './service';

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});
const errors = {
  400: json(ErrorBody, 'Invalid input'),
  401: json(ErrorBody, 'Sign in required'),
  403: json(ErrorBody, 'Not allowed'),
  404: json(ErrorBody, 'Not found'),
  409: json(ErrorBody, 'Conflict'),
};
const security = [{ devUser: [] }];
const CircleId = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
});
const InviteCode = z.object({
  code: z.string().openapi({ param: { name: 'code', in: 'path' }, example: '7K3M9QX2DA' }),
});

const router = new OpenAPIHono<AppEnv>();
router.use('/v1/circles', authRequired);
router.use('/v1/circles/*', authRequired);
router.use('/v1/invites/:code/join', authRequired);

export const circlesRouter = router
  .openapi(
    createRoute({
      method: 'post',
      path: '/v1/circles',
      tags: ['Circles'],
      summary: 'Create a circle and its season schedule',
      security,
      request: {
        body: { content: { 'application/json': { schema: CreateCircleBody } }, required: true },
      },
      responses: { 201: json(CircleDetail, 'Created'), ...errors },
    }),
    async (c) => {
      const userId = requireUser(c);
      const db = c.get('db');
      const id = await createCircle(db, userId, c.req.valid('json'));
      return c.json(await getCircleDetail(db, id, userId, c.get('config').appUrl), 201);
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/v1/circles/{id}',
      tags: ['Circles'],
      summary: 'A circle as seen by one of its members',
      security,
      request: { params: CircleId },
      responses: { 200: json(CircleDetail, 'The circle'), ...errors },
    }),
    async (c) => {
      const userId = requireUser(c);
      return c.json(
        await getCircleDetail(c.get('db'), c.req.valid('param').id, userId, c.get('config').appUrl),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/v1/circles/{id}/leave',
      tags: ['Circles'],
      summary: 'Leave a circle',
      security,
      request: { params: CircleId },
      responses: { 204: { description: 'Left' }, ...errors },
    }),
    async (c) => {
      const userId = requireUser(c);
      await leaveCircle(c.get('db'), c.req.valid('param').id, userId);
      return c.body(null, 204);
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/v1/invites/{code}',
      tags: ['Invites'],
      summary: 'Public preview of a circle behind an invite link (sign-in optional)',
      request: { params: InviteCode },
      responses: { 200: json(InvitePreview, 'Preview'), ...errors },
    }),
    async (c) => {
      const { code } = c.req.valid('param');
      if (!isInviteCode(code)) throw notFound('Invite');
      return c.json(await getInvitePreview(c.get('db'), code, c.get('userId')), 200);
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/v1/invites/{code}/join',
      tags: ['Invites'],
      summary: 'Join the circle, or its waitlist when it is full',
      security,
      request: { params: InviteCode },
      responses: { 200: json(JoinResult, 'Joined or waitlisted'), ...errors },
    }),
    async (c) => {
      const userId = requireUser(c);
      const { code } = c.req.valid('param');
      if (!isInviteCode(code)) throw notFound('Invite');
      return c.json(await joinByInvite(c.get('db'), code, userId), 200);
    },
  );
