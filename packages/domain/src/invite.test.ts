import { describe, expect, it } from 'vitest';
import { createInviteCode, isInviteCode, normalizeInviteCode } from './invite';

describe('invite codes', () => {
  it('creates valid codes', () => {
    for (let i = 0; i < 200; i++) expect(isInviteCode(createInviteCode())).toBe(true);
  });

  it.each([
    ['7K2M9QXH4P', '7K2M9QXH4P'],
    ['  7k2m-9qxh-4p ', '7K2M9QXH4P'],
    ['https://krug.am/i/7K2M9QXH4P', '7K2M9QXH4P'],
    ['https://krug.am/i/7K2M9QXH4P?utm=tg', '7K2M9QXH4P'],
    ['7K2M9QXHOP', '7K2M9QXH0P'],
    ['7K2M9QXHLP', '7K2M9QXH1P'],
  ])('normalizes %s', (input, expected) => expect(normalizeInviteCode(input)).toBe(expected));

  it.each(['', 'short', '7K2M9QXH4PX', 'https://krug.am/circles/abc', '7K2M9QXH4U'])(
    'rejects %s',
    (input) => expect(normalizeInviteCode(input)).toBeNull(),
  );
});
