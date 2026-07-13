import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { gradients } from '@/theme/gradients';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

// primary: the logo-gold gradient with dark navy text (the shield/star relation).
// secondary: quiet surface button for parallel actions. ghost: inline/text actions.
export function Button({ title, variant = 'primary', loading = false, disabled, style, ...rest }: ButtonProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;
  const contentColor =
    variant === 'primary' ? 'textOnPrimary' : variant === 'secondary' ? 'textPrimary' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, styles[variant], (pressed || isDisabled) && styles.dimmed, style]}
      {...rest}
    >
      {variant === 'primary' && (
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {loading ? (
        <ActivityIndicator color={colors[contentColor]} />
      ) : (
        <AppText variant="subtitle" color={contentColor}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      height: 52,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      // Clips the gradient fill to the rounded corners.
      overflow: 'hidden',
    },
    primary: {},
    secondary: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ghost: {
      height: 44,
    },
    dimmed: { opacity: 0.6 },
  });
