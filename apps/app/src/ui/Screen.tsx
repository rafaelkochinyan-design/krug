import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { maxContentWidth, space, useColors } from './theme';

/** Scrollable page with a readable max width on desktop and safe areas on phones. */
export function Screen({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: c.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
  },
  column: { width: '100%', maxWidth: maxContentWidth, gap: space.lg },
  card: { borderWidth: 1, borderRadius: 16, padding: space.lg, gap: space.sm },
});
