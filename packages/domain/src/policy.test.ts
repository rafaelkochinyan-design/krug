import { describe, expect, it } from 'vitest';
import {
  canCreateCircle,
  canEditCircle,
  canJoin,
  canLeave,
  canRemoveMember,
  canSeeChatLink,
  canSeeInvite,
  canSeeMemberNames,
  canViewCircle,
  firstName,
  isCircleOpen,
  toCircleMember,
  toInviteMember,
  type CircleStatus,
  type Viewer,
  type ViewerMembership,
} from './policy';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const anon: Viewer = { userId: null, isAdult: false };
const signedInAdult: Viewer = { userId: 'u-adult', isAdult: true };
const signedInMinor: Viewer = { userId: 'u-minor', isAdult: false };

const orgJoined: ViewerMembership = { role: 'organizer', status: 'joined' };
const cohostJoined: ViewerMembership = { role: 'co_host', status: 'joined' };
const memberJoined: ViewerMembership = { role: 'member', status: 'joined' };
const memberWaitlisted: ViewerMembership = { role: 'member', status: 'waitlisted' };
const memberLeft: ViewerMembership = { role: 'member', status: 'left' };
const memberRemoved: ViewerMembership = { role: 'member', status: 'removed' };

// ─── isCircleOpen ─────────────────────────────────────────────────────────────

describe('isCircleOpen', () => {
  it.each(['recruiting', 'active'] satisfies CircleStatus[])('%s → open', (status) => {
    expect(isCircleOpen(status)).toBe(true);
  });

  it.each(['draft', 'finished', 'cancelled'] satisfies CircleStatus[])(
    '%s → not open',
    (status) => {
      expect(isCircleOpen(status)).toBe(false);
    },
  );
});

// ─── canViewCircle ────────────────────────────────────────────────────────────

describe('canViewCircle', () => {
  it('returns false for null (anonymous)', () => {
    expect(canViewCircle(null)).toBe(false);
  });

  it('returns true for a joined member', () => {
    expect(canViewCircle(memberJoined)).toBe(true);
  });

  it('returns true for a waitlisted member', () => {
    expect(canViewCircle(memberWaitlisted)).toBe(true);
  });

  it('returns true for the organizer (joined)', () => {
    expect(canViewCircle(orgJoined)).toBe(true);
  });

  it('returns false for a left member', () => {
    expect(canViewCircle(memberLeft)).toBe(false);
  });

  it('returns false for a removed member', () => {
    expect(canViewCircle(memberRemoved)).toBe(false);
  });

  it('returns false for a signed-in outsider (no membership)', () => {
    // null membership represents a user with no row in memberships
    expect(canViewCircle(null)).toBe(false);
  });
});

// ─── canSeeInvite ─────────────────────────────────────────────────────────────

describe('canSeeInvite', () => {
  it('returns false for anonymous', () => {
    expect(canSeeInvite(null)).toBe(false);
  });

  it('returns true only for the organizer', () => {
    expect(canSeeInvite(orgJoined)).toBe(true);
  });

  it('returns false for a co-host', () => {
    expect(canSeeInvite(cohostJoined)).toBe(false);
  });

  it('returns false for a regular member', () => {
    expect(canSeeInvite(memberJoined)).toBe(false);
  });

  it('returns false for a waitlisted member', () => {
    expect(canSeeInvite(memberWaitlisted)).toBe(false);
  });

  it('returns false for left and removed members', () => {
    expect(canSeeInvite(memberLeft)).toBe(false);
    expect(canSeeInvite(memberRemoved)).toBe(false);
  });
});

// ─── canSeeChatLink ───────────────────────────────────────────────────────────

describe('canSeeChatLink', () => {
  it('returns false for anonymous', () => {
    expect(canSeeChatLink(null)).toBe(false);
  });

  it('returns true for a joined member', () => {
    expect(canSeeChatLink(memberJoined)).toBe(true);
  });

  it('returns true for the organizer', () => {
    expect(canSeeChatLink(orgJoined)).toBe(true);
  });

  it('returns false for a waitlisted member', () => {
    expect(canSeeChatLink(memberWaitlisted)).toBe(false);
  });

  it('returns false for left and removed members', () => {
    expect(canSeeChatLink(memberLeft)).toBe(false);
    expect(canSeeChatLink(memberRemoved)).toBe(false);
  });
});

// ─── canSeeMemberNames ────────────────────────────────────────────────────────

describe('canSeeMemberNames', () => {
  it('returns false for anonymous', () => {
    expect(canSeeMemberNames(anon)).toBe(false);
  });

  it('returns true for a signed-in adult', () => {
    expect(canSeeMemberNames(signedInAdult)).toBe(true);
  });

  it('returns true for a signed-in minor (name visibility is not gated on age)', () => {
    expect(canSeeMemberNames(signedInMinor)).toBe(true);
  });
});

// ─── canJoin ─────────────────────────────────────────────────────────────────

describe('canJoin', () => {
  const openStatus: CircleStatus = 'recruiting';
  const closedStatus: CircleStatus = 'finished';

  it('denies when the circle is not open (not_open → 409)', () => {
    const result = canJoin({
      viewer: signedInAdult,
      circleStatus: closedStatus,
      membership: null,
      blocked: false,
    });
    expect(result).toEqual({ allowed: false, reason: 'not_open' });
  });

  it('denies all closed statuses', () => {
    const closed: CircleStatus[] = ['draft', 'finished', 'cancelled'];
    for (const status of closed) {
      expect(
        canJoin({ viewer: signedInAdult, circleStatus: status, membership: null, blocked: false }),
      ).toMatchObject({ allowed: false, reason: 'not_open' });
    }
  });

  it('denies when blocked (blocked → 403), even with no existing membership', () => {
    const result = canJoin({
      viewer: signedInAdult,
      circleStatus: openStatus,
      membership: null,
      blocked: true,
    });
    expect(result).toEqual({ allowed: false, reason: 'blocked' });
  });

  it('denies blocked before checking existing membership (order matters)', () => {
    // If blocked AND already joined, blocked should win
    const result = canJoin({
      viewer: signedInAdult,
      circleStatus: openStatus,
      membership: memberJoined,
      blocked: true,
    });
    // blocked comes after not_open but before alreadyMember in the check order
    expect(result).toEqual({ allowed: false, reason: 'blocked' });
  });

  it('allows idempotently when already joined (alreadyMember: true, existingStatus: joined)', () => {
    const result = canJoin({
      viewer: signedInAdult,
      circleStatus: openStatus,
      membership: memberJoined,
      blocked: false,
    });
    expect(result).toEqual({ allowed: true, alreadyMember: true, existingStatus: 'joined' });
  });

  it('allows idempotently when already waitlisted (alreadyMember: true, existingStatus: waitlisted)', () => {
    const result = canJoin({
      viewer: signedInAdult,
      circleStatus: openStatus,
      membership: memberWaitlisted,
      blocked: false,
    });
    expect(result).toEqual({ allowed: true, alreadyMember: true, existingStatus: 'waitlisted' });
  });

  it('denies when removed (removed → 403)', () => {
    const result = canJoin({
      viewer: signedInAdult,
      circleStatus: openStatus,
      membership: memberRemoved,
      blocked: false,
    });
    expect(result).toEqual({ allowed: false, reason: 'removed' });
  });

  it('allows a left member to rejoin', () => {
    const result = canJoin({
      viewer: signedInAdult,
      circleStatus: openStatus,
      membership: memberLeft,
      blocked: false,
    });
    expect(result).toEqual({ allowed: true, alreadyMember: false });
  });

  it('allows a new user with no membership', () => {
    const result = canJoin({
      viewer: signedInAdult,
      circleStatus: openStatus,
      membership: null,
      blocked: false,
    });
    expect(result).toEqual({ allowed: true, alreadyMember: false });
  });

  describe('adult check (requireAdult)', () => {
    it('defaults to not enforcing the adult check', () => {
      // A minor can join when requireAdult is not set
      const result = canJoin({
        viewer: signedInMinor,
        circleStatus: openStatus,
        membership: null,
        blocked: false,
      });
      expect(result).toEqual({ allowed: true, alreadyMember: false });
    });

    it('denies a minor when requireAdult=true (not_adult → 403)', () => {
      const result = canJoin({
        viewer: signedInMinor,
        circleStatus: openStatus,
        membership: null,
        blocked: false,
        requireAdult: true,
      });
      expect(result).toEqual({ allowed: false, reason: 'not_adult' });
    });

    it('allows an adult when requireAdult=true', () => {
      const result = canJoin({
        viewer: signedInAdult,
        circleStatus: openStatus,
        membership: null,
        blocked: false,
        requireAdult: true,
      });
      expect(result).toEqual({ allowed: true, alreadyMember: false });
    });

    it('not_open takes priority over not_adult', () => {
      const result = canJoin({
        viewer: signedInMinor,
        circleStatus: closedStatus,
        membership: null,
        blocked: false,
        requireAdult: true,
      });
      expect(result).toEqual({ allowed: false, reason: 'not_open' });
    });

    it('blocked takes priority over not_adult', () => {
      const result = canJoin({
        viewer: signedInMinor,
        circleStatus: openStatus,
        membership: null,
        blocked: true,
        requireAdult: true,
      });
      expect(result).toEqual({ allowed: false, reason: 'blocked' });
    });

    it('removed takes priority over not_adult', () => {
      const result = canJoin({
        viewer: signedInMinor,
        circleStatus: openStatus,
        membership: memberRemoved,
        blocked: false,
        requireAdult: true,
      });
      expect(result).toEqual({ allowed: false, reason: 'removed' });
    });
  });
});

// ─── canLeave ─────────────────────────────────────────────────────────────────

describe('canLeave', () => {
  it('denies when there is no membership (not_member → 404)', () => {
    expect(canLeave(null)).toEqual({ allowed: false, reason: 'not_member' });
  });

  it('denies when status is left (not_member → 404)', () => {
    expect(canLeave(memberLeft)).toEqual({ allowed: false, reason: 'not_member' });
  });

  it('denies when status is removed (not_member → 404)', () => {
    expect(canLeave(memberRemoved)).toEqual({ allowed: false, reason: 'not_member' });
  });

  it('denies when the organizer tries to leave (organizer → 409)', () => {
    expect(canLeave(orgJoined)).toEqual({ allowed: false, reason: 'organizer' });
  });

  it('allows a joined member to leave', () => {
    expect(canLeave(memberJoined)).toEqual({ allowed: true });
  });

  it('allows a waitlisted member to leave', () => {
    expect(canLeave(memberWaitlisted)).toEqual({ allowed: true });
  });

  it('allows a co-host to leave', () => {
    expect(canLeave(cohostJoined)).toEqual({ allowed: true });
  });
});

// ─── canRemoveMember ──────────────────────────────────────────────────────────

describe('canRemoveMember', () => {
  it('organizer can remove a member', () => {
    expect(canRemoveMember(orgJoined, memberJoined)).toBe(true);
  });

  it('co-host can remove a member', () => {
    expect(canRemoveMember(cohostJoined, memberJoined)).toBe(true);
  });

  it('regular member cannot remove another member', () => {
    expect(canRemoveMember(memberJoined, { role: 'member', status: 'joined' })).toBe(false);
  });

  it('nobody can remove the organizer', () => {
    expect(canRemoveMember(orgJoined, orgJoined)).toBe(false);
    expect(canRemoveMember(cohostJoined, orgJoined)).toBe(false);
    expect(canRemoveMember(memberJoined, orgJoined)).toBe(false);
  });

  it('organizer can remove a co-host', () => {
    expect(canRemoveMember(orgJoined, cohostJoined)).toBe(true);
  });
});

// ─── canEditCircle ────────────────────────────────────────────────────────────

describe('canEditCircle', () => {
  it('returns false for anonymous', () => {
    expect(canEditCircle(null)).toBe(false);
  });

  it('returns true only for the organizer', () => {
    expect(canEditCircle(orgJoined)).toBe(true);
  });

  it('returns false for a co-host', () => {
    expect(canEditCircle(cohostJoined)).toBe(false);
  });

  it('returns false for a regular member', () => {
    expect(canEditCircle(memberJoined)).toBe(false);
  });
});

// ─── canCreateCircle ──────────────────────────────────────────────────────────

describe('canCreateCircle', () => {
  it('returns false for anonymous', () => {
    expect(canCreateCircle(anon)).toBe(false);
  });

  it('returns false for anonymous even with requireAdult false', () => {
    expect(canCreateCircle(anon, { requireAdult: false })).toBe(false);
  });

  it('returns true for a signed-in minor when requireAdult is not set (not enforced until PR10)', () => {
    expect(canCreateCircle(signedInMinor)).toBe(true);
  });

  it('returns true for a signed-in minor when requireAdult is false', () => {
    expect(canCreateCircle(signedInMinor, { requireAdult: false })).toBe(true);
  });

  it('returns false for a signed-in minor when requireAdult is true', () => {
    expect(canCreateCircle(signedInMinor, { requireAdult: true })).toBe(false);
  });

  it('returns true for a signed-in adult when requireAdult is true', () => {
    expect(canCreateCircle(signedInAdult, { requireAdult: true })).toBe(true);
  });

  it('returns true for a signed-in adult when requireAdult is not set', () => {
    expect(canCreateCircle(signedInAdult)).toBe(true);
  });
});

// ─── firstName ───────────────────────────────────────────────────────────────

describe('firstName', () => {
  it('returns the first word of a full name', () => {
    expect(firstName('Ani Petrosyan')).toBe('Ani');
  });

  it('trims surrounding whitespace', () => {
    expect(firstName('  Aram  ')).toBe('Aram');
  });

  it('handles a single-word name', () => {
    expect(firstName('Lilit')).toBe('Lilit');
  });

  it('returns empty string for an empty input', () => {
    expect(firstName('')).toBe('');
  });

  it('handles extra internal whitespace', () => {
    expect(firstName('Ara  Grigoryan')).toBe('Ara');
  });
});

// ─── toCircleMember ───────────────────────────────────────────────────────────

describe('toCircleMember — does not leak extra fields', () => {
  it('returns only userId, name, role', () => {
    const input = {
      userId: 'u1',
      name: 'Ani Petrosyan',
      role: 'member' as const,
      // extra fields that must never reach other users
      email: 'ani@example.com',
      telegramChatId: '12345',
      adultConfirmedAt: new Date(),
    };
    const result = toCircleMember(input);
    expect(result).toEqual({ userId: 'u1', name: 'Ani Petrosyan', role: 'member' });
    expect(JSON.stringify(result)).not.toContain('email');
    expect(JSON.stringify(result)).not.toContain('telegramChatId');
    expect(JSON.stringify(result)).not.toContain('adultConfirmedAt');
  });

  it('preserves the role value', () => {
    const result = toCircleMember({ userId: 'u2', name: 'Davit', role: 'organizer' });
    expect(result.role).toBe('organizer');
  });
});

// ─── toInviteMember ──────────────────────────────────────────────────────────

describe('toInviteMember — does not leak extra fields', () => {
  it('returns only firstName and image', () => {
    const input = {
      name: 'Mariam Sargsyan',
      image: 'https://example.com/photo.jpg',
      email: 'mariam@example.com',
      telegramChatId: '99999',
    };
    const result = toInviteMember(input);
    expect(result).toEqual({ firstName: 'Mariam', image: 'https://example.com/photo.jpg' });
    expect(JSON.stringify(result)).not.toContain('email');
    expect(JSON.stringify(result)).not.toContain('telegramChatId');
    expect(JSON.stringify(result)).not.toContain('Sargsyan');
  });

  it('handles a null image', () => {
    const result = toInviteMember({ name: 'Ani', image: null });
    expect(result).toEqual({ firstName: 'Ani', image: null });
  });
});
