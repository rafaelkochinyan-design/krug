import { Text as RNText, type TextProps } from 'react-native';
import { font, useColors, type Colors } from './theme';

type Variant = keyof typeof font;

export function Text({
  variant = 'body',
  color = 'text',
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: keyof Colors }) {
  const c = useColors();
  return <RNText style={[font[variant], { color: c[color] }, style]} {...rest} />;
}
