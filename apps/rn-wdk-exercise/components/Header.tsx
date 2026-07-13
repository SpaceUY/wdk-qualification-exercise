import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LiquidGlassView } from '@callstack/liquid-glass';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

const PRESS_SPRING = { damping: 18, stiffness: 260, mass: 0.6 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type IconComponent = ComponentType<{ size?: number; color?: string }>;

type HeaderProps = {
  left?: ReactNode;
  right?: ReactNode;
};

export function Header({ left, right }: HeaderProps) {
  const styles = useThemedStyles(createHeaderStyles);

  return (
    <View style={styles.container}>
      {left ?? null}
      {right ?? null}
    </View>
  );
}

type HeaderIconButtonProps = {
  icon: IconComponent;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

export function HeaderIconButton({ icon: Icon, onPress, accessibilityLabel, testID }: HeaderIconButtonProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createIconButtonStyles);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.88, PRESS_SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, PRESS_SPRING); }}
      style={[styles.button, animatedStyle]}
    >
      <LiquidGlassView effect="none" colorScheme="dark" style={styles.glass}>
        {/* The border/background live on this plain View, not on LiquidGlassView
            itself — iOS's native glass view reflows its internal content view
            around its own border, which throws off child positioning if the
            border is set directly on it (see GlassTabBar's pill/pillSurface split). */}
        <View style={[styles.surface, styles.glassSurface]}>
          <Icon size={20} color={colors.textPrimary} />
        </View>
      </LiquidGlassView>
    </AnimatedPressable>
  );
}

type HeaderBackTitleProps = {
  title: string;
  onBack?: () => void;
};

export function HeaderBackTitle({ title, onBack }: HeaderBackTitleProps) {
  const router = useRouter();
  const styles = useThemedStyles(createBackTitleStyles);

  return (
    <View style={styles.container}>
      <HeaderIconButton
        icon={ChevronLeft}
        onPress={onBack ?? (() => router.back())}
        accessibilityLabel="Back"
        testID="header-back"
      />
      <AppText variant="title" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
    </View>
  );
}

const createHeaderStyles = (_colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});

const createIconButtonStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  glass: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  surface: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mirrors GlassTabBar's glassSurface: native liquid glass (effect="regular") is
  // disabled for now so iOS matches the Android look — translucent navy + hairline
  // border reads as glass on the dark theme on every platform.
  glassSurface: {
    backgroundColor: 'rgba(21, 28, 36, 0.92)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});

const createBackTitleStyles = (_colors: ThemeColors) => StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
});
