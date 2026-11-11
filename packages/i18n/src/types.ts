import type { en } from './locales/en';

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
/** Every locale must have exactly the shape of the English messages. */
export type Messages = Widen<typeof en>;
export type Locale = 'hy' | 'ru' | 'en';
