import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { radius, space, useColors } from './theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, testID }: Props) {
  const c = useColors();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: primary ? c.accent : c.surface,
          borderColor: primary ? c.accent : c.border,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? c.onAccent : c.text} />
      ) : (
        <Text variant="label" style={{ color: primary ? c.onAccent : c.text }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
