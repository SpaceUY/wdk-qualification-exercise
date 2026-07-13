import { StyleSheet, View } from 'react-native';
import { isMainnetNetwork } from '@/config/networkMeta';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

export function NetworkFundsBanner({ network }: { network: string }) {
  const styles = useThemedStyles(createStyles);
  if (!isMainnetNetwork(network)) return null;

  return (
    <View style={styles.banner} testID="mainnet-funds-banner">
      <AppText variant="caption" color="warningText" style={styles.text}>
        ⚠️ This network uses real funds — transactions are irreversible.
      </AppText>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  text: { fontWeight: '600' },
});
