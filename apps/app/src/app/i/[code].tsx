import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { api, RequestError, unwrap, useDevUser } from '@/lib/api';
import { weekdayKey, formatMeeting } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import {
  Button,
  Card,
  DevUserBar,
  ErrorView,
  Loading,
  Screen,
  space,
  Text,
  useErrorText,
} from '@/ui';

export default function InviteScreen() {
  // Remount per test user so a previous user's join result is never shown to the next one.
  const devUser = useDevUser();
  return <Invite key={devUser} />;
}

function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['invite', code],
    queryFn: () => unwrap(api.GET('/v1/invites/{code}', { params: { path: { code } } })),
  });
  const join = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/invites/{code}/join', { params: { path: { code } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invite', code] }),
  });
  const openCircle = (id: string) => router.replace({ pathname: '/circles/[id]', params: { id } });

  if (q.isPending)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (q.isError) {
    const notFound = q.error instanceof RequestError && q.error.status === 404;
    return (
      <Screen>
        {notFound ? (
          <Text color="danger">{t('invite.notFound')}</Text>
        ) : (
          <ErrorView error={q.error} onRetry={() => void q.refetch()} />
        )}
      </Screen>
    );
  }

  const p = q.data;
  const result = join.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('invite.title') }} />
      <View style={{ gap: space.xs }}>
        <Text variant="heading" accessibilityRole="header">
          {p.title}
        </Text>
        <Text color="textMuted">{p.activity}</Text>
        <Text>
          {t('circleExtra.every', {
            weekday: t(`weekday.${weekdayKey(p.weekday)}`),
            time: p.startTime,
            weeks: p.weeks,
          })}
        </Text>
        {p.venueText ? <Text>{p.venueText}</Text> : null}
        {p.firstMeetingAt ? (
          <Text>
            {t('invite.firstMeeting', {
              date: formatMeeting(p.firstMeetingAt, currentLocale(), p.timeZone),
            })}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {t('invite.by', { name: p.organizerName })} ·{' '}
          {t('circleExtra.spotsLeft', { count: p.spotsLeft })}
        </Text>
      </View>

      {result ? (
        <Card>
          <Text color={result.status === 'joined' ? 'success' : 'text'} accessibilityRole="alert">
            {result.status === 'joined' ? t('invite.joined') : t('invite.waitlisted')}
          </Text>
          <Button title={t('invite.openCircle')} onPress={() => openCircle(result.circleId)} />
        </Card>
      ) : p.myStatus && p.circleId ? (
        <Card>
          <Text>
            {p.myStatus === 'joined' ? t('invite.alreadyIn') : t('invite.alreadyWaitlisted')}
          </Text>
          <Button title={t('invite.openCircle')} onPress={() => openCircle(p.circleId!)} />
        </Card>
      ) : p.open ? (
        <>
          {join.isError ? <Text color="danger">{errorText(join.error)}</Text> : null}
          <Button
            testID="join"
            title={p.spotsLeft > 0 ? t('invite.join') : t('invite.joinWaitlist')}
            loading={join.isPending}
            onPress={() => join.mutate()}
          />
        </>
      ) : (
        <Text color="textMuted">{t('invite.closed')}</Text>
      )}
      <DevUserBar />
    </Screen>
  );
}
