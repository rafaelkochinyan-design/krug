import { users, type Db } from '@krug/db';

/**
 * TEMPORARY (until step 0.7): fixed test users for local development and QA, so testers can act as
 * different people via the x-dev-user-id header. Only called when DEV_AUTH is on, which production refuses.
 */
export const DEV_USERS = [
  { id: 'dev-anna', name: 'Anna' },
  { id: 'dev-arman', name: 'Arman' },
  { id: 'dev-mariam', name: 'Mariam' },
  { id: 'dev-davit', name: 'Davit' },
] as const;

export async function seedDevUsers(db: Db): Promise<void> {
  await db
    .insert(users)
    .values(DEV_USERS.map((u) => ({ ...u, adultConfirmedAt: new Date() })))
    .onConflictDoNothing();
}
