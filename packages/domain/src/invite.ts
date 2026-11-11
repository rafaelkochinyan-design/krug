// Crockford base32 without I, L, O, U: easy to read aloud and to type from a screenshot.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 10;

/** Random, URL-safe invite code (50 bits of entropy). */
export function createInviteCode(random: (bytes: number) => Uint8Array = defaultRandom): string {
  const bytes = random(INVITE_CODE_LENGTH);
  let out = '';
  for (const b of bytes) out += ALPHABET.charAt(b % 32);
  return out;
}

export function isInviteCode(value: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${INVITE_CODE_LENGTH}}$`).test(value);
}

function defaultRandom(n: number): Uint8Array {
  const { crypto } = globalThis as unknown as {
    crypto: { getRandomValues<T extends Uint8Array>(array: T): T };
  };
  return crypto.getRandomValues(new Uint8Array(n));
}

/**
 * Accepts what people actually paste — a full invite link, a code with spaces or dashes, lower case,
 * or Crockford look-alikes (O→0, I/L→1) — and returns the canonical code, or null.
 */
export function normalizeInviteCode(input: string): string | null {
  const trimmed = input.trim();
  const fromLink = /\/i\/([^/?#\s]+)/.exec(trimmed)?.[1] ?? trimmed;
  const code = fromLink
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return isInviteCode(code) ? code : null;
}
