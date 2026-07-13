import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LiquidGlassContainerView, LiquidGlassView } from '@callstack/liquid-glass';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

// Vertical room the floating bar occupies. Scrollable screens under the bar pad
// their content bottom by this much so the last row can scroll clear of it.
export const TAB_BAR_CLEARANCE = 104;

type IconName = keyof typeof Ionicons.glyphMap;

// Only these navigator routes render as pill tabs. Everything else registered on
// the (wallet) Tabs navigator (send, receive, wallet-setup, cashback) is a pushed
// flow with href:null — when one of those is focused, the bar hides entirely.
const TAB_ITEMS: {
  name: 'index' | 'history';
  label: string;
  icon: IconName;
  iconInactive: IconName;
}[] = [
  { name: 'index', label: 'Home', icon: 'home', iconInactive: 'home-outline' },
  { name: 'history', label: 'History', icon: 'time', iconInactive: 'time-outline' },
];

type TabName = (typeof TAB_ITEMS)[number]['name'];

// The slice of react-navigation's BottomTabBarProps this bar consumes, typed
// locally: @react-navigation/bottom-tabs is only a transitive dependency under
// pnpm, so importing its types directly would be a phantom dependency.
export type GlassTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: {
      type: 'tabPress';
      target?: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
};

const SPRING = { damping: 18, stiffness: 220, mass: 0.6 };

export function GlassTabBar({ state, navigation }: GlassTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const focusedName = state.routes[state.index]?.name;
  const activeIndex = TAB_ITEMS.findIndex((t) => t.name === focusedName);

  const [itemLayouts, setItemLayouts] = useState<
    Partial<Record<TabName, { x: number; width: number }>>
  >({});
  const highlightX = useSharedValue(0);
  const highlightWidth = useSharedValue(0);

  const activeLayout = activeIndex === -1 ? undefined : itemLayouts[TAB_ITEMS[activeIndex].name];
  useEffect(() => {
    if (!activeLayout) return;
    if (highlightWidth.value === 0) {
      // First measurement: place the highlight instantly instead of sliding in
      // from the pill's left edge.
      highlightX.value = activeLayout.x;
      highlightWidth.value = activeLayout.width;
      return;
    }
    highlightX.value = withSpring(activeLayout.x, SPRING);
    highlightWidth.value = withSpring(activeLayout.width, SPRING);
  }, [activeLayout, highlightX, highlightWidth]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highlightX.value }],
    width: highlightWidth.value,
  }));

  // A pushed flow (send, receive, …) is focused: it covers the whole screen.
  if (activeIndex === -1) return null;

  const onItemLayout = (name: TabName) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setItemLayouts((prev) => {
      const current = prev[name];
      if (current && current.x === x && current.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  };

  const onTabPress = (name: TabName, key: string, isActive: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!isActive && !event.defaultPrevented) navigation.navigate(name);
  };

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + spacing.sm }]}
      pointerEvents="box-none"
    >
      <LiquidGlassContainerView spacing={spacing.xl} style={styles.row}>
        <LiquidGlassView
          effect="none"
          colorScheme="dark"
          style={[styles.pill, styles.glassSurface]}
        >
          <Animated.View style={[styles.highlight, highlightStyle]} />
          {TAB_ITEMS.map((item, index) => {
            const route = state.routes.find((r) => r.name === item.name);
            if (!route) return null;
            const isActive = index === activeIndex;
            return (
              <Pressable
                key={item.name}
                testID={`glass-tab-${item.name}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onLayout={onItemLayout(item.name)}
                onPress={() => onTabPress(item.name, route.key, isActive)}
                style={styles.item}
              >
                <Ionicons
                  name={isActive ? item.icon : item.iconInactive}
                  size={20}
                  color={isActive ? colors.primary : colors.textMuted}
                />
                <AppText
                  variant="caption"
                  color={isActive ? 'primary' : 'textMuted'}
                  style={styles.itemLabel}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </LiquidGlassView>

        <LiquidGlassView
          effect="none"
          colorScheme="dark"
          interactive
          style={[styles.circle, styles.glassSurface]}
        >
          <Pressable
            testID="glass-tab-send"
            accessibilityRole="button"
            accessibilityLabel="Send"
            hitSlop={8}
            onPress={() => router.push('/(wallet)/send')}
            style={styles.circlePressable}
          >
            <Ionicons name="arrow-up" size={22} color={colors.textPrimary} />
          </Pressable>
        </LiquidGlassView>

        <LiquidGlassView
          effect="none"
          colorScheme="dark"
          interactive
          style={[styles.circle, styles.glassSurface]}
        >
          <Pressable
            testID="glass-tab-receive"
            accessibilityRole="button"
            accessibilityLabel="Receive"
            hitSlop={8}
            onPress={() => router.push('/(wallet)/receive')}
            style={styles.circlePressable}
          >
            <Ionicons name="arrow-down" size={22} color={colors.textPrimary} />
          </Pressable>
        </LiquidGlassView>
      </LiquidGlassContainerView>
    </View>
  );
}

const CIRCLE_SIZE = 52;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    padding: spacing.xs,
    overflow: 'hidden',
  },
  // Native liquid glass (effect="regular") is disabled for now so iOS matches
  // the Android look: translucent navy + hairline border reads as glass on the
  // dark theme on every platform.
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
  highlight: {
    // top/bottom 0, not spacing.xs: the pill's own padding already insets
    // this from the outer edge, so adding another inset here would double
    // it and leave the highlight short of the item it's supposed to match.
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    gap: 2,
  },
  itemLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
  },
  circlePressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
