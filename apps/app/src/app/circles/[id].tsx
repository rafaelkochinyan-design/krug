import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { api, unwrap } from '@/lib/api';
import { weekdayKey, formatMeeting } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { Button, Card, ErrorView, Loading, Screen, space, Text, useErrorText } from '@/ui';

export default function CircleScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ['circle', id],
    queryFn: () => unwrap(api.GET('/v1/circles/{id}', { params: { path: { id } } })),
  });
  const leave = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/circles/{id}/leave', { params: { path: { id } } })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['circle', id] });
      router.replace('/');
    },
  });

  if (q.isPending)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (q.isError)
    return (
      <Screen>
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      </Screen>
    );

  const { circle, meetings, members, me, spotsLeft, waitlistCount, chatLink, invite } = q.data;
  const locale = currentLocale();
  const joined = me.status === 'joined';

  return (
    <Screen>
      <Stack.Screen options={{ title: circle.title }} />
      {created ? (
        <Card>
          <Text color="success">{t('circle.created')}</Text>
        </Card>
      ) : null}

      <View style={{ gap: space.xs }}>
        <Text variant="heading" accessibilityRole="header">
          {circle.title}
        </Text>
        <Text color="textMuted">{circle.activity}</Text>
        <Text>
          {t('circleExtra.every', {
            weekday: t(`weekday.${weekdayKey(circle.weekday)}`),
            time: circle.startTime,
            weeks: circle.weeks,
          })}
        </Text>
        {circle.venueText ? <Text>{circle.venueText}</Text> : null}
        <Text variant="caption" color="textMuted">
          {t('circleExtra.spotsLeft', { count: spotsLeft })}
          {waitlistCount > 0 ? ` · ${t('circleExtra.waitlist', { count: waitlistCount })}` : ''}
        </Text>
      </View>

      {me.status === 'waitlisted' ? (
        <Card>
          <Text>{t('circleExtra.waitlistedNotice')}</Text>
        </Card>
      ) : null}

      {invite ? (
        <Card>
          <Text variant="label">{t('circleExtra.invite')}</Text>
          <Text selectable testID="invite-url">
            {invite.url}
          </Text>
          <Button
            variant="secondary"
            title={copied ? t('circleExtra.copied') : t('circleExtra.copy')}
            onPress={async () => {
              await Clipboard.setStringAsync(invite.url);
              setCopied(true);
            }}
          />
        </Card>
      ) : null}

      {joined && chatLink ? (
        <Button
          variant="secondary"
          title={t('circleExtra.chat')}
          onPress={() => void Linking.openURL(chatLink)}
        />
      ) : null}

      <Card>
        <Text variant="label">{t('circleExtra.members')}</Text>
        {members.map((m) => (
          <Text key={m.userId}>
            {m.name}
            {m.role === 'organizer' ? ` · ${t('circleExtra.organizer')}` : ''}
          </Text>
        ))}
      </Card>

      <Card>
        <Text variant="label">{t('circle.schedule')}</Text>
        {meetings.map((m) => (
          <View
            key={m.id}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}
          >
            <Text color="textMuted">{t('circle.meeting', { index: m.index })}</Text>
            <Text>{formatMeeting(m.startsAt, locale, circle.timeZone)}</Text>
          </View>
        ))}
      </Card>

      {me.role !== 'organizer' && (joined || me.status === 'waitlisted') ? (
        <>
          {leave.isError ? <Text color="danger">{errorText(leave.error)}</Text> : null}
          <Button
            variant="secondary"
            title={t('circleExtra.leave')}
            loading={leave.isPending}
            onPress={() => leave.mutate()}
          />
        </>
      ) : null}
    </Screen>
  );
}
