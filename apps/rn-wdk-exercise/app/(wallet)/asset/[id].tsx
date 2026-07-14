import { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { PriceChart } from '@/components/asset/PriceChart';
import { AssetHistoryEmpty, type AssetHistoryEmptyState } from '@/components/asset/AssetHistoryEmpty';

const RANGE_LABELS: Record<PriceHistoryRange, string> = { '1d': '1D', '1w': '1W', '1m': '1M', '1y': '1Y' };

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

  const historyEmptyState: AssetHistoryEmptyState =
    syncStatus === 'syncing' || (syncStatus === 'done' && isLoading)
      ? 'loading'
      : syncStatus === 'error' || isError
        ? 'error'
        : !isHistorySupportedNetwork(asset.network)
          ? 'network-unsupported'
          : !isHistorySupportedAsset(asset.network, asset.isNative)
            ? 'asset-unsupported'
            : 'empty';

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
        ListEmptyComponent={
          <AssetHistoryEmpty
            state={historyEmptyState}
            networkName={getNetworkDisplayName(asset.network)}
            symbol={asset.symbol}
            onRetry={retry}
            onReceive={() => router.push('/(wallet)/receive')}
          />
        }
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
});
