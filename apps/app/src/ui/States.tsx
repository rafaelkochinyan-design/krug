import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RequestError } from '@/lib/api';
import { Button } from './Button';
import { Text } from './Text';
import { space, useColors } from './theme';

export function Loading() {
  const c = useColors();
  const { t } = useTranslation();
  return (
    <View
      style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}
      accessibilityLabel={t('common.loading')}
    >
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

/** Maps any failure to a human sentence; never shows raw server messages to people. */
export function useErrorText() {
  const { t } = useTranslation();
  return (error: unknown): string => {
    if (error instanceof RequestError) {
      if (error.status === 0) return t('errors.network');
      if (error.status === 404) return t('errors.notFound');
      if (error.code === 'validation_error') return t('errors.validation');
    }
    return t('errors.generic');
  };
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const text = useErrorText()(error);
  return (
    <View style={{ gap: space.md, paddingVertical: space.xl }} accessibilityRole="alert">
      <Text color="danger">{text}</Text>
      {onRetry ? <Button variant="secondary" title={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}
