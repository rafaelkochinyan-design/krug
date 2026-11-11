import { normalizeInviteCode } from '@krug/domain/invite';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, DevUserBar, LanguageSwitcher, Screen, space, Text, TextField } from '@/ui';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();

  const openInvite = () => {
    const normalized = normalizeInviteCode(code);
    if (!normalized) return setCodeError(t('invite.notFound'));
    setCodeError(undefined);
    router.push({ pathname: '/i/[code]', params: { code: normalized } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('app.name') }} />
      <View style={{ gap: space.sm, paddingTop: space.xl }}>
        <Text variant="title" accessibilityRole="header">
          {t('home.title')}
        </Text>
        <Text color="textMuted">{t('home.lead')}</Text>
      </View>
      <Button
        testID="create-circle"
        title={t('home.create')}
        onPress={() => router.push('/circles/new')}
      />
      {joining ? (
        <Card>
          <TextField
            label={t('invite.codeLabel')}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={openInvite}
            error={codeError}
          />
          <Button title={t('invite.go')} onPress={openInvite} />
        </Card>
      ) : (
        <Button
          testID="join-circle"
          variant="secondary"
          title={t('home.join')}
          onPress={() => setJoining(true)}
        />
      )}
      <LanguageSwitcher />
      <DevUserBar />
    </Screen>
  );
}
