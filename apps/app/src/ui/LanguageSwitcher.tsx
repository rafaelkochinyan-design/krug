import { LOCALES, type Locale } from '@krug/i18n';
import { useTranslation } from 'react-i18next';
import { currentLocale, setLocale } from '@/lib/i18n';
import { Chips } from './Chips';

export function LanguageSwitcher() {
  const { t } = useTranslation(); // re-renders on language change
  return (
    <Chips<Locale>
      label={t('language.label')}
      options={LOCALES.map((l) => ({ value: l, label: t(`language.${l}`) }))}
      value={currentLocale()}
      onChange={setLocale}
    />
  );
}
