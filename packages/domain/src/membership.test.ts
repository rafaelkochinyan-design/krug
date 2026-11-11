import { describe, expect, it } from 'vitest';
import { placeNewMember } from './membership';
import { createInviteCode, isInviteCode, INVITE_CODE_LENGTH } from './invite';

describe('placeNewMember', () => {
  it('joins while there is room and waitlists once full', () => {
    expect(placeNewMember(7, 8)).toBe('joined');
    expect(placeNewMember(8, 8)).toBe('waitlisted');
    expect(placeNewMember(9, 8)).toBe('waitlisted');
  });
  it('rejects a capacity below 1', () => {
    expect(() => placeNewMember(0, 0)).toThrow(RangeError);
  });
});

describe('invite codes', () => {
  it('produces readable codes of a fixed length', () => {
    for (let i = 0; i < 200; i++) {
      const code = createInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(isInviteCode(code)).toBe(true);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });
  it('rejects malformed codes', () => {
    expect(isInviteCode('abc')).toBe(false);
    expect(isInviteCode('OOOOOOOOOO')).toBe(false);
  });
});
