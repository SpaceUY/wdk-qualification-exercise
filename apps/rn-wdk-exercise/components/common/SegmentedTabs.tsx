import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

export type SegmentedTab<K extends string> = {
  key: K;
  label: string;
  testID?: string;
};

export type SegmentedTabsProps<K extends string> = {
  tabs: SegmentedTab<K>[];
  activeKey: K;
  onChange: (key: K) => void;
};

// Pill-style segmented control, visually identical to the tab bar hand-rolled in
// cashback/index.tsx. Extracted once the address-book screens became the second
// and third usages of the pattern.
export function SegmentedTabs<K extends string>({ tabs, activeKey, onChange }: SegmentedTabsProps<K>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          testID={tab.testID}
          style={[styles.tab, activeKey === tab.key && styles.tabActive]}
          onPress={() => onChange(tab.key)}
        >
          <AppText color={activeKey === tab.key ? 'textPrimary' : 'textMuted'} style={styles.tabText}>
            {tab.label}
          </AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 10,
    // surfaceMuted, not border: the hairline border tokens are translucent and
    // read as invisible when used as a fill.
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontWeight: '600' },
});
