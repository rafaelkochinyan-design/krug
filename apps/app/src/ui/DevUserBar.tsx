import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DEV_AUTH, DEV_USERS, setDevUser, useDevUser } from '@/lib/api';
import { Chips } from './Chips';
import { Card } from './Screen';
import { Text } from './Text';

/** TEMPORARY until step 0.7: shown only when EXPO_PUBLIC_DEV_AUTH=1, never in production builds. */
export function DevUserBar() {
  const { t } = useTranslation();
  const user = useDevUser();
  const qc = useQueryClient();
  if (!DEV_AUTH) return null;
  return (
    <Card>
      <Text variant="caption" color="textMuted">
        {t('dev.banner')}
      </Text>
      <Chips<string>
        label={t('dev.userId')}
        options={DEV_USERS.map((u) => ({ value: u, label: u.replace('dev-', '') }))}
        value={user}
        onChange={(u) => {
          setDevUser(u);
          void qc.resetQueries(); // cached data belonged to the previous user; refetch as the new one
        }}
      />
    </Card>
  );
}
