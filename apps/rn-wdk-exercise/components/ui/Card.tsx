import { StyleSheet, View, type ViewProps } from 'react-native';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';

export type CardProps = ViewProps & {
  // Elevated cards use the logo navy (surfaceElevated): hero, modals, highlights.
  elevated?: boolean;
};

// Base surface: one elevation step above the background, with the hairline
// translucent border that defines the app's "glass" edge.
export function Card({ elevated = false, style, ...rest }: CardProps) {
  const styles = useThemedStyles(createStyles);
  return <View {...rest} style={[styles.base, elevated && styles.elevated, style]} />;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    elevated: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderStrong,
    },
  });
