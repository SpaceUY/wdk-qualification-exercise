import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComingSoonBanner } from '@/components/ComingSoonBanner';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import { RowSkeleton } from '@/components/RowSkeleton';

const LOADING_SKELETON_ROWS = 4;

export type AssetHistoryEmptyState =
  | 'loading'
  | 'error'
  | 'network-unsupported'
  | 'asset-unsupported'
  | 'empty';

export type AssetHistoryEmptyProps = {
  state: AssetHistoryEmptyState;
  networkName: string;
  symbol: string;
  onRetry: () => void;
  onReceive: () => void;
};

// Presentational history empty/loading/error/unsupported states for the asset screen.
// Replaces the five-branch `historyEmpty` chain previously inlined in asset/[id].tsx.
export function AssetHistoryEmpty({ state, networkName, symbol, onRetry, onReceive }: AssetHistoryEmptyProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  if (state === 'loading') {
    return (
      <View testID="asset-history-skeleton">
        {Array.from({ length: LOADING_SKELETON_ROWS }, (_, i) => <RowSkeleton key={i} />)}
      </View>
    );
  }
  if (state === 'error') {
    return (
      <View style={styles.historyState}>
        <AppText color="danger" style={styles.errorText}>Something went wrong. Please try again.</AppText>
        <TouchableOpacity testID="asset-history-retry" style={styles.retryButton} onPress={onRetry}>
          <AppText color="primary" style={styles.retryText}>Retry</AppText>
        </TouchableOpacity>
      </View>
    );
  }
  if (state === 'network-unsupported') {
    return <ComingSoonBanner message={`Transaction history for ${networkName} isn't tracked yet — coming soon.`} />;
  }
  if (state === 'asset-unsupported') {
    return <ComingSoonBanner message={`Transaction history for ${symbol} isn't tracked yet — coming soon.`} />;
  }
  return (
    <View style={styles.historyState}>
      <Ionicons name="receipt-outline" size={40} color={colors.textSubtle} />
      <AppText color="textMuted" style={styles.noMarketText}>No transactions yet</AppText>
      <TouchableOpacity style={styles.emptyCta} onPress={onReceive}>
        <AppText color="primary" style={styles.retryText}>Receive funds</AppText>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  historyState: { alignItems: 'center', padding: spacing.xl },
  errorText: { textAlign: 'center' },
  retryButton: { marginTop: spacing.md },
  retryText: { fontWeight: '600' },
  noMarketText: { marginTop: spacing.md },
  emptyCta: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
});
