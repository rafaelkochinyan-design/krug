import '@/lib/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { RequestError } from '@/lib/api';
import { palette } from '@/ui';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { t } = useTranslation();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 4xx answers will not change on retry; network and 5xx might.
            retry: (count, error) =>
              count < 2 &&
              !(error instanceof RequestError && error.status >= 400 && error.status < 500),
            staleTime: 30_000,
          },
        },
      }),
  );
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = palette[scheme];
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{
          ...base,
          colors: {
            ...base.colors,
            background: c.background,
            card: c.background,
            text: c.text,
            border: c.border,
            primary: c.accent,
          },
        }}
      >
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ title: t('app.name'), headerShadowVisible: false }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
