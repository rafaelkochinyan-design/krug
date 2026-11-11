import { en } from './locales/en';
import { hy } from './locales/hy';
import { ru } from './locales/ru';
import type { Locale, Messages } from './types';

export type { Locale, Messages };
export { searchKey } from './translit';

export const LOCALES: readonly Locale[] = ['hy', 'ru', 'en'];
export const DEFAULT_LOCALE: Locale = 'hy';
export const resources: Record<Locale, Messages> = { hy, ru, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
