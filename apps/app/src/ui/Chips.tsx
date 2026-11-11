import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { radius, space, useColors } from './theme';

interface Option<T extends string | number> {
  value: T;
  label: string;
}

/** Single-choice chips (weekday, language). Wraps on narrow screens. */
export function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? c.accent : c.border,
                  backgroundColor: selected ? c.accent : c.surface,
                },
              ]}
            >
              <Text variant="caption" style={{ color: selected ? c.onAccent : c.text }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
