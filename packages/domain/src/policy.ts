import type { MembershipStatus } from './membership';

export type { MembershipStatus };

/** Role a user holds in a circle. */
export type Role = 'organizer' | 'co_host' | 'member';

/**
 * Status of a circle in its lifecycle.
 * Mirrors the `circle_status` DB enum; kept here so policy is dependency-free.
 */
export type CircleStatus = 'draft' | 'recruiting' | 'active' | 'finished' | 'cancelled';

/** The viewer of a request (may be anonymous). */
export interface Viewer {
  userId: string | null;
  isAdult: boolean;
}

/** The viewer's membership in a specific circle. */
export interface ViewerMembership {
  role: Role;
  status: MembershipStatus;
}

/** Circle statuses that allow new members to join. */
export const CIRCLE_OPEN_STATUSES = ['recruiting', 'active'] as const;

/** Returns true when the circle is accepting new members. */
export function isCircleOpen(status: CircleStatus): boolean {
  return (CIRCLE_OPEN_STATUSES as readonly string[]).includes(status);
}

/** Returns true when the viewer can see the circle detail (must be joined or waitlisted). */
export function canViewCircle(m: ViewerMembership | null): boolean {
  if (m === null) return false;
  return m.status === 'joined' || m.status === 'waitlisted';
}

/** Only the organizer can see the invite link. */
export function canSeeInvite(m: ViewerMembership | null): boolean {
  return m !== null && m.role === 'organizer';
}

/** Only joined members can see the chat link (not waitlisted). */
export function canSeeChatLink(m: ViewerMembership | null): boolean {
  return m !== null && m.status === 'joined';
}

/**
 * Signed-in users can see the names of other members.
 * Defined now; wired to the member list in PR2.
 */
export function canSeeMemberNames(viewer: Viewer): boolean {
  return viewer.userId != null;
}

/** Reason a join attempt is denied. HTTP mapping: not_open → 409, others → 403. */
export type JoinDenial = 'not_open' | 'blocked' | 'removed' | 'not_adult';

export interface CanJoinInput {
  viewer: Viewer;
  circleStatus: CircleStatus;
  membership: ViewerMembership | null;
  blocked: boolean;
  /**
   * Enforce the 18+ requirement. Default **false**.
   * Pass `true` only after `adultConfirmedAt` is wired to sign-up (PR10).
   */
  requireAdult?: boolean;
}

/**
 * Decides whether the viewer may join the circle.
 *
 * HTTP mapping:
 *   - `not_open`   → 409 conflict
 *   - `blocked`    → 403 forbidden
 *   - `removed`    → 403 forbidden
 *   - `not_adult`  → 403 forbidden
 *
 * Order reproduces `joinByInvite` exactly:
 *   1. Circle must be open (not_open)
 *   2. Must not be blocked (blocked)
 *   3. Already joined/waitlisted → alreadyMember: true (idempotent)
 *   4. Removed → cannot rejoin (removed)
 *   5. Adult check if requireAdult (not_adult) — enforcement is PR10
 */
export function canJoin(
  input: CanJoinInput,
):
  | { allowed: true; alreadyMember: true; existingStatus: 'joined' | 'waitlisted' }
  | { allowed: true; alreadyMember: false }
  | { allowed: false; reason: JoinDenial } {
  const { circleStatus, membership, blocked, requireAdult = false, viewer } = input;
  if (!isCircleOpen(circleStatus)) return { allowed: false, reason: 'not_open' };
  if (blocked) return { allowed: false, reason: 'blocked' };
  if (membership?.status === 'joined' || membership?.status === 'waitlisted') {
    return { allowed: true, alreadyMember: true, existingStatus: membership.status };
  }
  if (membership?.status === 'removed') return { allowed: false, reason: 'removed' };
  if (requireAdult && !viewer.isAdult) return { allowed: false, reason: 'not_adult' };
  return { allowed: true, alreadyMember: false };
}

/** Reason a leave attempt is denied. HTTP mapping: not_member → 404, organizer → 409. */
export type LeaveDenial = 'not_member' | 'organizer';

/**
 * Decides whether the viewer may leave the circle.
 *
 * HTTP mapping:
 *   - `not_member` → 404 not_found
 *   - `organizer`  → 409 conflict
 */
export function canLeave(
  m: ViewerMembership | null,
): { allowed: true } | { allowed: false; reason: LeaveDenial } {
  if (m === null || (m.status !== 'joined' && m.status !== 'waitlisted')) {
    return { allowed: false, reason: 'not_member' };
  }
  if (m.role === 'organizer') return { allowed: false, reason: 'organizer' };
  return { allowed: true };
}

/**
 * Decides whether the acting member may remove another member.
 * Not wired to any route yet (planned).
 */
export function canRemoveMember(actor: ViewerMembership, target: ViewerMembership): boolean {
  if (target.role === 'organizer') return false;
  return actor.role === 'organizer' || actor.role === 'co_host';
}

/**
 * Decides whether the viewer may edit the circle.
 * Not wired to any route yet (planned).
 */
export function canEditCircle(m: ViewerMembership | null): boolean {
  return m !== null && m.role === 'organizer';
}

/**
 * Decides whether the viewer may create a circle.
 *
 * - Signed in: always required.
 * - Adult: only required when `requireAdult` is true (enforced PR10).
 *   Pass `{ requireAdult: true }` once `adultConfirmedAt` is wired to sign-up.
 *
 * Not wired to any route yet (planned).
 */
export function canCreateCircle(viewer: Viewer, options?: { requireAdult?: boolean }): boolean {
  if (viewer.userId == null) return false;
  if ((options?.requireAdult ?? false) && !viewer.isAdult) return false;
  return true;
}

// ─── Field-visibility projections ────────────────────────────────────────────

/**
 * Returns the first word of a full name.
 * Used to show the organizer's first name only on the public invite preview.
 */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export interface CircleMemberInput {
  userId: string;
  name: string;
  role: Role;
}

/**
 * Whitelist projection for a circle member.
 * Strips any extra fields (email, telegram, etc.) that must never reach other users.
 */
export function toCircleMember(m: CircleMemberInput): { userId: string; name: string; role: Role } {
  return { userId: m.userId, name: m.name, role: m.role };
}

export interface InviteMemberInput {
  name: string;
  image: string | null;
}

/**
 * Returns first name and profile image only.
 * Defined now; used in PR2 to show invite page member previews.
 */
export function toInviteMember(m: InviteMemberInput): { firstName: string; image: string | null } {
  return { firstName: firstName(m.name), image: m.image };
}
