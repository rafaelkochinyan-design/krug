import { useColorScheme } from 'react-native';

/** Design tokens. Components read colors only from here, so dark mode and rebranding are one-file changes. */
export const palette = {
  light: {
    background: '#FAFAF7',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F1EC',
    border: '#E2E2DC',
    text: '#1B1B18',
    textMuted: '#63635C',
    accent: '#3B5BDB',
    onAccent: '#FFFFFF',
    danger: '#C92A2A',
    success: '#2B8A3E',
  },
  dark: {
    background: '#121211',
    surface: '#1C1C1A',
    surfaceMuted: '#262623',
    border: '#34342F',
    text: '#F2F2EE',
    textMuted: '#A6A69E',
    accent: '#748FFC',
    onAccent: '#0B0B0A',
    danger: '#FF6B6B',
    success: '#69DB7C',
  },
} as const;

export type Colors = { [K in keyof typeof palette.light]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = {
  title: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;
export const maxContentWidth = 640;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}
