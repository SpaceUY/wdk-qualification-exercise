import { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { PRICE_HISTORY_RANGES, type PriceHistoryRange } from '@/utils/api';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import { getNetworkDisplayName, isHistorySupportedAsset, isHistorySupportedNetwork } from '@/config/networkMeta';
import { ComingSoonBanner } from '@/components/ComingSoonBanner';
import { useAssetBalances } from '@/hooks/useAssetBalances';
import { usePrices } from '@/hooks/usePrices';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { useFilteredTransactionHistory } from '@/hooks/useFilteredTransactionHistory';
import { useDirectionFilter } from '@/hooks/useDirectionFilter';
import { buildAssetRows } from '@/components/balance';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AmountText, AppText, FilterChips } from '@/components/ui';
import { Header, HeaderBackTitle } from '@/components/Header';
import { TransferRow } from '@/components/TransferRow';
import { TransferDetailModal } from '@/components/TransferDetailModal';
import { RowSkeleton } from '@/components/RowSkeleton';
import { PriceChart } from '@/components/asset/PriceChart';

const RANGE_LABELS: Record<PriceHistoryRange, string> = { '1d': '1D', '1w': '1W', '1m': '1M', '1y': '1Y' };
const LOADING_SKELETON_ROWS = 4;

export default function AssetDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { width: windowWidth } = useWindowDimensions();
  // LineChart defaults its SVG width to the full screen width, ignoring the
  // screen's own horizontal padding — pass the actual container width explicitly.
  const chartWidth = windowWidth - spacing.lg * 2;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const asset = ALL_ASSET_CONFIGS.find((c) => c.id === id);

  const [range, setRange] = useState<PriceHistoryRange>('1d');
  const [selected, setSelected] = useState<TokenTransfer | null>(null);

  const { balanceByAssetId } = useAssetBalances();
  const { data: pricesData } = usePrices();
  const {
    data: history,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = usePriceHistory(asset?.symbol, range);
  const historySupported =
    asset != null &&
    isHistorySupportedNetwork(asset.network) &&
    isHistorySupportedAsset(asset.network, asset.isNative);

  const { transfers, isLoading, isError, syncStatus, retry, myAddresses } =
    useFilteredTransactionHistory({
      network: asset?.network,
      symbol: asset?.symbol,
      enabled: historySupported,
    });

  const {
    filter: directionFilter,
    setFilter: setDirectionFilter,
    options: directionOptions,
    visibleTransfers,
  } = useDirectionFilter(transfers, myAddresses);

  if (!asset) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <Header left={<HeaderBackTitle title="Asset" />} />
        <View style={styles.center}>
          <AppText color="textMuted">Asset not found</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const { rows } = buildAssetRows([asset], balanceByAssetId, pricesData?.prices, pricesData?.changePct24h);
  const row = rows[0];

  const points = history?.points ?? [];
  const hasMarketData = !history || points.length > 0;

  const header = (
    <View>
      <View style={styles.balanceCard}>
        <AppText variant="caption" color="textMuted">Balance</AppText>
        <AmountText variant="title" value={`${row?.cryptoAmount ?? '—'} ${asset.symbol}`} />
        <View style={styles.fiatRow}>
          {row?.fiatAmount != null && (
            <AmountText variant="body" color="textMuted" value={row.fiatAmount} />
          )}
          {row?.changePct24h != null && (
            <View
              style={[
                styles.changePill,
                { backgroundColor: row.changePct24h.isPositive ? colors.successBg : colors.primarySoft },
              ]}
            >
              <AppText
                variant="caption"
                color={row.changePct24h.isPositive ? 'successText' : 'dangerText'}
                style={styles.changePillText}
              >
                {row.changePct24h.label}
              </AppText>
            </View>
          )}
        </View>
      </View>

      <PriceChart
        points={points}
        hasMarketData={hasMarketData}
        isLoading={historyLoading}
        isError={historyError}
        onRetry={() => refetchHistory()}
        width={chartWidth}
      />

      {!historyLoading && !historyError && !hasMarketData && (
        <ComingSoonBanner
          message={`Price history for ${asset.symbol} isn't available yet — coming soon.`}
        />
      )}

      {hasMarketData && (
        <View style={styles.rangeSelector}>
          {PRICE_HISTORY_RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              testID={`asset-range-${r}`}
              style={[styles.rangePill, r === range && styles.rangePillActive]}
              onPress={() => setRange(r)}
            >
              <AppText
                variant="caption"
                color={r === range ? 'primary' : 'textMuted'}
                style={styles.rangePillText}
              >
                {RANGE_LABELS[r]}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <AppText variant="subtitle" style={styles.historyTitle}>Activity</AppText>

      {historySupported && (
        <FilterChips
          options={directionOptions}
          value={directionFilter}
          onChange={setDirectionFilter}
          testIDPrefix="asset-history-filter"
          style={styles.directionChips}
        />
      )}
    </View>
  );

  const historyReady = syncStatus === 'done' && !isLoading && !isError;

  let historyEmpty;
  if (syncStatus === 'syncing' || (syncStatus === 'done' && isLoading)) {
    historyEmpty = (
      <View testID="asset-history-skeleton">
        {Array.from({ length: LOADING_SKELETON_ROWS }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </View>
    );
  } else if (syncStatus === 'error' || isError) {
    historyEmpty = (
      <View style={styles.historyState}>
        <AppText color="danger" style={styles.errorText}>
          Something went wrong. Please try again.
        </AppText>
        <TouchableOpacity testID="asset-history-retry" style={styles.retryButton} onPress={retry}>
          <AppText color="primary" style={styles.retryText}>Retry</AppText>
        </TouchableOpacity>
      </View>
    );
  } else if (!isHistorySupportedNetwork(asset.network)) {
    historyEmpty = (
      <ComingSoonBanner
        message={`Transaction history for ${getNetworkDisplayName(asset.network)} isn't tracked yet — coming soon.`}
      />
    );
  } else if (!isHistorySupportedAsset(asset.network, asset.isNative)) {
    historyEmpty = (
      <ComingSoonBanner
        message={`Transaction history for ${asset.symbol} isn't tracked yet — coming soon.`}
      />
    );
  } else {
    historyEmpty = (
      <View style={styles.historyState}>
        <Ionicons name="receipt-outline" size={40} color={colors.textSubtle} />
        <AppText color="textMuted" style={styles.noMarketText}>No transactions yet</AppText>
        <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(wallet)/receive')}>
          <AppText color="primary" style={styles.retryText}>Receive funds</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header left={<HeaderBackTitle title={`${asset.symbol} · ${asset.name}`} />} />
      {/* One FlatList with everything above the transfers in its header — nesting a
          list inside a ScrollView would trigger the VirtualizedLists warning. */}
      <FlatList
        contentContainerStyle={styles.container}
        data={historyReady ? (visibleTransfers ?? []) : []}
        keyExtractor={(item) => `${item.transactionHash}-${item.from}-${item.to}-${item.amount}-${item.ts}`}
        ListHeaderComponent={header}
        ListEmptyComponent={historyEmpty}
        renderItem={({ item }) => (
          <TransferRow transfer={item} myAddresses={myAddresses} onPress={() => setSelected(item)} />
        )}
      />

      <TransferDetailModal
        transfer={selected}
        myAddresses={myAddresses}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  balanceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  fiatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  changePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  changePillText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  noMarketText: { marginTop: spacing.md },
  rangeSelector: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  rangePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  rangePillActive: { backgroundColor: colors.primarySoft },
  rangePillText: { fontWeight: '600' },
  historyTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  // The screen container already pads horizontally and the title provides the top gap,
  // so reset FilterChips' built-in margins.
  directionChips: { marginHorizontal: 0, marginTop: 0, marginBottom: spacing.md },
  historyState: { alignItems: 'center', padding: spacing.xl },
  errorText: { textAlign: 'center' },
  retryButton: { marginTop: spacing.md },
  retryText: { fontWeight: '600' },
  emptyCta: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
});
