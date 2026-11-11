import { MAX_CAPACITY, MIN_CAPACITY } from './limits';

export type MembershipStatus = 'joined' | 'waitlisted' | 'left' | 'removed';

/** Decides where a new member lands, given how many people are already in the circle. */
export function placeNewMember(activeMembers: number, capacity: number): 'joined' | 'waitlisted' {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be >= 1');
  return activeMembers < capacity ? 'joined' : 'waitlisted';
}

export { MAX_CAPACITY, MIN_CAPACITY };
