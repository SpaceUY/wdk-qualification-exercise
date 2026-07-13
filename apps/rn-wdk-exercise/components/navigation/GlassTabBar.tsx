import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Home, type LucideIcon } from 'lucide-react-native';
import { LiquidGlassView } from '@callstack/liquid-glass';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

// Vertical room the floating bar occupies. Scrollable screens under the bar pad
// their content bottom by this much so the last row can scroll clear of it.
export const TAB_BAR_CLEARANCE = 104;

// Only these navigator routes render as pill tabs. Everything else registered on
// the (wallet) Tabs navigator (send, receive, wallet-setup, cashback) is a pushed
// flow with href:null — when one of those is focused, the bar hides entirely.
const TAB_ITEMS: {
  name: 'index' | 'history';
  label: string;
  icon: LucideIcon;
}[] = [
  { name: 'index', label: 'Home', icon: Home },
  { name: 'history', label: 'History', icon: Clock },
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
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const focusedName = state.routes[state.index]?.name;
  const activeIndex = TAB_ITEMS.findIndex((t) => t.name === focusedName);

  const [itemLayouts, setItemLayouts] = useState<
    Partial<Record<TabName, { x: number; width: number }>>
  >({});
  // The highlight slides horizontally within the pill's padded area. Its x and
  // width come from the active item's measured frame; its vertical inset is the
  // pill's padding (static top/bottom in styles.highlight), so the gap is the
  // same on all four sides. The first item's measured x already equals the pill
  // padding, so the left/right gaps at the extremes match that padding too.
  const hlX = useSharedValue(0);
  const hlWidth = useSharedValue(0);

  const activeLayout = activeIndex === -1 ? undefined : itemLayouts[TAB_ITEMS[activeIndex].name];
  useEffect(() => {
    if (!activeLayout) return;
    if (hlWidth.value === 0) {
      // First measurement: snap into place instead of sliding in from x=0.
      hlX.value = activeLayout.x;
      hlWidth.value = activeLayout.width;
      return;
    }
    hlX.value = withSpring(activeLayout.x, SPRING);
    hlWidth.value = withSpring(activeLayout.width, SPRING);
  }, [activeLayout, hlX, hlWidth]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: hlX.value }],
    width: hlWidth.value,
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
      <LiquidGlassView effect="none" colorScheme="dark" style={styles.pill}>
        {/* The visible surface (bg + border), padding, row layout and clipping
            all live on this plain View. The highlight is measured against and
            clipped by exactly this box, so it can never spill past the visible
            pill — unlike when the surface lived on the native glass view, which
            did not size itself to this child. */}
        <View style={[styles.pillSurface, styles.glassSurface]}>
          {/* The track is the padded inner area. Uniform padding on all four
              sides comes from pillSurface's padding wrapping it. The highlight
              fills the track vertically (top/bottom: 0) and slides horizontally
              within it; equal-width slots (item flex: 1) make the two extremes
              mirror images, so the outer gap is identical for Home and History. */}
          <View style={styles.track}>
            <Animated.View style={[styles.highlight, highlightStyle]} />
            {TAB_ITEMS.map((item, index) => {
              const route = state.routes.find((r) => r.name === item.name);
              if (!route) return null;
              const isActive = index === activeIndex;
              const Icon = item.icon;
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
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 2}
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
          </View>
        </View>
      </LiquidGlassView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    borderRadius: radius.full,
  },
  pillSurface: {
    // Uniform padding on all four sides — this is the gap between the pill edge
    // and the sliding highlight/track.
    padding: spacing.xs,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
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
    // Fills the track vertically; x/width are animated to the active slot (see
    // highlightStyle). The track sits inside pillSurface's uniform padding, so
    // the highlight keeps that same gap on every side at both extremes.
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  item: {
    // Equal-width slots (minWidth) so the two tabs are symmetric and the
    // highlight is a consistent shape that slides between them with the same
    // outer gap at each extreme.
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  itemLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
});
