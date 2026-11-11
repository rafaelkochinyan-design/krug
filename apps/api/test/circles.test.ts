import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { blocks } from '@krug/db';
import { setup, validCircle } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => (t = await setup()));
afterAll(() => t.close());

describe('health and errors', () => {
  it('reports the database as up', async () => {
    expect(await t.call('GET', '/health')).toEqual({
      status: 200,
      body: { status: 'ok', db: 'ok' },
    });
  });
  it('returns the common error shape for unknown routes', async () => {
    const r = await t.call('GET', '/nope');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('not_found');
  });
  it('publishes an OpenAPI document', async () => {
    const r = await t.call('GET', '/openapi.json');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.paths)).toEqual(
      expect.arrayContaining([
        '/v1/circles',
        '/v1/circles/{id}',
        '/v1/invites/{code}',
        '/v1/invites/{code}/join',
      ]),
    );
  });
});

describe('creating a circle', () => {
  it('requires sign-in', async () => {
    const r = await t.call('POST', '/v1/circles', { body: validCircle });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('unauthorized');
  });

  it('answers 401 before validating input', async () => {
    const r = await t.call('POST', '/v1/circles', { body: {} });
    expect(r.status).toBe(401);
  });

  it('ignores an unknown dev user id', async () => {
    const r = await t.call('POST', '/v1/circles', { as: 'no-such-user', body: validCircle });
    expect(r.status).toBe(401);
  });

  it('rejects invalid input with field details', async () => {
    const org = await t.makeUser('Ani Petrosyan');
    const r = await t.call('POST', '/v1/circles', {
      as: org,
      body: { ...validCircle, weekday: 9, startTime: '25:00' },
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation_error');
    expect(r.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['weekday', 'startTime']),
    );
  });

  it('creates the circle, the organizer membership and the weekly schedule in Yerevan time', async () => {
    const org = await t.makeUser('Ani Petrosyan');
    const r = await t.call('POST', '/v1/circles', { as: org, body: validCircle });
    expect(r.status).toBe(201);
    expect(r.body.circle).toMatchObject({
      title: validCircle.title,
      timeZone: 'Asia/Yerevan',
      status: 'recruiting',
    });
    expect(r.body.meetings).toHaveLength(8);
    expect(r.body.meetings[0]).toMatchObject({
      index: 1,
      startsAt: '2026-11-12T15:30:00.000Z',
      status: 'scheduled',
    });
    expect(r.body.me).toEqual({ role: 'organizer', status: 'joined' });
    expect(r.body.spotsLeft).toBe(2); // capacity 3, organizer included
    expect(r.body.invite.url).toBe(`https://krug.test/i/${r.body.invite.code}`);
  });
});

describe('invites and joining', () => {
  async function circle() {
    const org = await t.makeUser('Ani Petrosyan');
    const r = await t.call('POST', '/v1/circles', { as: org, body: validCircle });
    return { org, id: r.body.circle.id as string, code: r.body.invite.code as string };
  }

  it('shows a public preview without contacts or member names', async () => {
    const { code } = await circle();
    const r = await t.call('GET', `/v1/invites/${code}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      title: validCircle.title,
      organizerName: 'Ani',
      spotsLeft: 2,
      open: true,
    });
    expect(JSON.stringify(r.body)).not.toContain('Petrosyan');
  });

  it('tells a signed-in viewer their place, and reveals the circle id only to people in it', async () => {
    const { code, org, id } = await circle();
    const stranger = await t.makeUser('Lilit');
    const anon = await t.call('GET', `/v1/invites/${code}`);
    expect(anon.body).toMatchObject({ myStatus: null, circleId: null });
    expect((await t.call('GET', `/v1/invites/${code}`, { as: stranger })).body).toMatchObject({
      myStatus: null,
      circleId: null,
    });
    expect((await t.call('GET', `/v1/invites/${code}`, { as: org })).body).toMatchObject({
      myStatus: 'joined',
      circleId: id,
    });
  });

  it('answers not found for a malformed or unknown code', async () => {
    expect((await t.call('GET', '/v1/invites/xx')).status).toBe(404);
    expect((await t.call('GET', '/v1/invites/ZZZZZZZZZZ')).status).toBe(404);
  });

  it('joins until full, then waitlists; joining twice changes nothing', async () => {
    const { code, id, org } = await circle();
    const a = await t.makeUser('Aram');
    const b = await t.makeUser('Mariam');
    const c = await t.makeUser('Davit');
    expect((await t.call('POST', `/v1/invites/${code}/join`, { as: a })).body.status).toBe(
      'joined',
    );
    expect((await t.call('POST', `/v1/invites/${code}/join`, { as: b })).body.status).toBe(
      'joined',
    );
    expect((await t.call('POST', `/v1/invites/${code}/join`, { as: c })).body.status).toBe(
      'waitlisted',
    );
    expect((await t.call('POST', `/v1/invites/${code}/join`, { as: a })).body.status).toBe(
      'joined',
    );

    const detail = await t.call('GET', `/v1/circles/${id}`, { as: org });
    expect(detail.body.members.map((m: { name: string }) => m.name)).toEqual([
      'Ani Petrosyan',
      'Aram',
      'Mariam',
    ]);
    expect(detail.body.spotsLeft).toBe(0);
    expect(detail.body.waitlistCount).toBe(1);
  });

  it('hides the circle from outsiders and the invite from regular members', async () => {
    const { code, id } = await circle();
    const outsider = await t.makeUser('Outsider');
    expect((await t.call('GET', `/v1/circles/${id}`, { as: outsider })).status).toBe(404);
    const member = await t.makeUser('Member');
    await t.call('POST', `/v1/invites/${code}/join`, { as: member });
    const r = await t.call('GET', `/v1/circles/${id}`, { as: member });
    expect(r.status).toBe(200);
    expect(r.body.invite).toBeNull();
  });

  it('does not let a blocked person join the organizer’s circle', async () => {
    const { code, org } = await circle();
    const blocked = await t.makeUser('Blocked');
    await t.db.insert(blocks).values({ blockerId: org, blockedId: blocked });
    const r = await t.call('POST', `/v1/invites/${code}/join`, { as: blocked });
    expect(r.status).toBe(403);
  });

  it('lets a member leave and rejoin, but not the organizer', async () => {
    const { code, id, org } = await circle();
    const m = await t.makeUser('Leaver');
    await t.call('POST', `/v1/invites/${code}/join`, { as: m });
    expect((await t.call('POST', `/v1/circles/${id}/leave`, { as: m })).status).toBe(204);
    expect((await t.call('GET', `/v1/circles/${id}`, { as: m })).status).toBe(404);
    expect((await t.call('POST', `/v1/invites/${code}/join`, { as: m })).body.status).toBe(
      'joined',
    );
    expect((await t.call('POST', `/v1/circles/${id}/leave`, { as: org })).status).toBe(409);
  });
});

describe('config safety', () => {
  it('refuses dev auth in production', async () => {
    const { loadConfig } = await import('../src/config');
    expect(() =>
      loadConfig({ NODE_ENV: 'production', DEV_AUTH: '1', DATABASE_URL: 'postgres://x' }),
    ).toThrow();
  });
});
