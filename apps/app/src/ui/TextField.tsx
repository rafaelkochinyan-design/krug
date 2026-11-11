import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { font, radius, space, useColors } from './theme';

export function TextField({
  label,
  error,
  ...input
}: TextInputProps & { label: string; error?: string }) {
  const c = useColors();
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        style={[
          font.body,
          styles.input,
          { color: c.text, backgroundColor: c.surface, borderColor: error ? c.danger : c.border },
        ]}
        {...input}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: { minHeight: 48, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.md },
});
