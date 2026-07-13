import { Text, type TextProps } from 'react-native';
import { useThemeColors, type ThemeColors } from '@/theme/colors';
import { typography, type TypographyVariant } from '@/theme/tokens';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  // Any palette token — in practice the text tokens, `primary`, or status colors.
  color?: keyof ThemeColors;
};

// The only Text the UI layer should use: every variant/color pair comes from the
// theme, so a raw fontSize or hex in a screen is a review flag.
export function AppText({ variant = 'body', color = 'textPrimary', style, ...rest }: AppTextProps) {
  const colors = useThemeColors();
  return <Text {...rest} style={[typography[variant], { color: colors[color] }, style]} />;
}
