import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LiquidGlassView } from '@callstack/liquid-glass';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

export type NetworkFilter = 'all' | 'mainnet' | 'testnet';

const FILTERS: { key: NetworkFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mainnet', label: 'Mainnet' },
  { key: 'testnet', label: 'Testnet' },
];

const PRESS_SPRING = { damping: 18, stiffness: 260, mass: 0.6 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type NetworkFilterChipsProps = {
  value: NetworkFilter;
  onChange: (value: NetworkFilter) => void;
};

// Sits between the balance card and the asset list, scoping which chains' rows show.
export function NetworkFilterChips({ value, onChange }: NetworkFilterChipsProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {FILTERS.map((filter) => (
        <FilterChip
          key={filter.key}
          label={filter.label}
          testID={`network-filter-${filter.key}`}
          isActive={filter.key === value}
          onPress={() => onChange(filter.key)}
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
