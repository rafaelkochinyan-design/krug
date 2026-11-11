import 'i18next';
import type { Messages } from '@krug/i18n';

// Typed translation keys: a misspelled key is a compile error, not an empty label in production.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Messages };
  }
}
