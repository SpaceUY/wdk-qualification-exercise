import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LiquidGlassView } from '@callstack/liquid-glass';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from './AppText';

const PRESS_SPRING = { damping: 18, stiffness: 260, mass: 0.6 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type FilterChipOption<T extends string> = { key: T; label: string };

export type FilterChipsProps<T extends string> = {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Each chip gets `${testIDPrefix}-${option.key}`. */
  testIDPrefix: string;
  /** Merged over the row style — lets embedders (e.g. a form card) reset the
      built-in margins or allow wrapping. */
  style?: StyleProp<ViewStyle>;
};

// Single-select glass chip row shared by the dashboard's network filter and
// the history screen's direction filter.
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
  style,
}: FilterChipsProps<T>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.row, style]}>
      {options.map((option) => (
        <FilterChip
          key={option.key}
          label={option.label}
          testID={`${testIDPrefix}-${option.key}`}
          isActive={option.key === value}
          onPress={() => onChange(option.key)}
          styles={styles}
        />
      ))}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

// Own component (not inlined in the .map above) so each chip gets its own
// press-scale shared value — hooks can't live inside a loop callback.
function FilterChip({
  label,
  testID,
  isActive,
  onPress,
  styles,
}: {
  label: string;
  testID: string;
  isActive: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.92, PRESS_SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, PRESS_SPRING); }}
      style={animatedStyle}
    >
      <LiquidGlassView effect="none" colorScheme="dark" style={styles.chip}>
        <View style={[styles.chipSurface, isActive ? styles.chipSurfaceActive : styles.chipSurfaceInactive]}>
          <AppText
            variant="caption"
            color={isActive ? 'textOnPrimary' : 'textMuted'}
            style={styles.chipText}
          >
            {label}
          </AppText>
        </View>
      </LiquidGlassView>
    </AnimatedPressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
    },
    chip: {
      borderRadius: radius.full,
      overflow: 'hidden',
    },
    chipSurface: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    // Mirrors the app's other glass surfaces (GlassTabBar's pillSurface, the
    // dashboard settings button): translucent navy + hairline border, not a
    // flat fill, so the chip reads as glass instead of a solid button.
    chipSurfaceInactive: {
      backgroundColor: 'rgba(21, 28, 36, 0.92)',
      borderColor: colors.borderStrong,
    },
    chipSurfaceActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontWeight: '600',
    },
  });
