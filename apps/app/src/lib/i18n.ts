import { DEFAULT_LOCALE, isLocale, resources, type Locale } from '@krug/i18n';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import { storage } from './storage';

const KEY = 'krug.locale';

/** Saved choice first, then the device languages in order, then Armenian. */
export function detectLocale(): Locale {
  const saved = storage.get(KEY);
  if (isLocale(saved)) return saved;
  for (const l of getLocales()) {
    if (isLocale(l.languageCode)) return l.languageCode;
  }
  return DEFAULT_LOCALE;
}

function applyDocumentLang(locale: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined')
    document.documentElement.lang = locale;
}

void i18n.use(initReactI18next).init({
  resources: {
    hy: { translation: resources.hy },
    ru: { translation: resources.ru },
    en: { translation: resources.en },
  },
  lng: detectLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false,
});
applyDocumentLang(i18n.language);

export function setLocale(locale: Locale) {
  storage.set(KEY, locale);
  applyDocumentLang(locale);
  void i18n.changeLanguage(locale);
}

export function currentLocale(): Locale {
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

export default i18n;
