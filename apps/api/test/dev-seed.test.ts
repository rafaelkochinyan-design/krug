import { afterEach, describe, expect, it } from 'vitest';
import { DEV_USERS, seedDevUsers } from '../src/dev-seed';
import { setup, validCircle } from './helpers';

let ctx: Awaited<ReturnType<typeof setup>>;
afterEach(async () => ctx?.close());

describe('dev users', () => {
  it('can be seeded twice and act through the dev header', async () => {
    ctx = await setup();
    await seedDevUsers(ctx.db);
    await seedDevUsers(ctx.db);
    const res = await ctx.call('POST', '/v1/circles', { as: DEV_USERS[0].id, body: validCircle });
    expect(res.status).toBe(201);
  });
});
