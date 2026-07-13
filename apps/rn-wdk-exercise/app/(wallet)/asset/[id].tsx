import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LineChart } from 'react-native-wagmi-charts';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { PRICE_HISTORY_RANGES, type PriceHistoryRange } from '@/utils/api';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import { getNetworkDisplayName, isHistorySupportedAsset, isHistorySupportedNetwork } from '@/config/networkMeta';
import { ComingSoonBanner } from '@/components/ComingSoonBanner';
import { useAssetBalances } from '@/hooks/useAssetBalances';
import { usePrices } from '@/hooks/usePrices';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { useFilteredTransactionHistory } from '@/hooks/useFilteredTransactionHistory';
import { buildAssetRows } from '@/components/balance';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { formatFiat } from '@/utils/balance';
import { isReceived } from '@/utils/transfers';
import { AmountText, AppText, FilterChips, Skeleton, type FilterChipOption } from '@/components/ui';
import { Header, HeaderBackTitle } from '@/components/Header';
import { TransferRow } from '@/components/TransferRow';
import { TransferDetailModal } from '@/components/TransferDetailModal';
import { RowSkeleton } from '@/components/RowSkeleton';

const RANGE_LABELS: Record<PriceHistoryRange, string> = { '1d': '1D', '1w': '1W', '1m': '1M', '1y': '1Y' };
// Fixed height so the layout doesn't jump between skeleton, chart, and no-data states.
const CHART_HEIGHT = 280;
const CHART_Y_GUTTER = spacing.xxl;
// Reserved margin on the right for price labels, kept clear of the plotted line — sized
// to the label text itself so there's no dead space between the line and the numbers.
export const CHART_AXIS_WIDTH = 70;
// Mirrors react-native-wagmi-charts' internal reserved space for cursor labels at the bottom.
const CHART_X_AXIS_RESERVED_HEIGHT = 40;
const AXIS_TICK_COUNT = 4;
const LOADING_SKELETON_ROWS = 4;
// Rough width of one glyph at the axis labels' caption font size (13px) — used to shrink
// the reserved gutter (and widen the plotted line) when the price range's labels are
// shorter than CHART_AXIS_WIDTH was sized for, e.g. "$0.01" for a low-priced asset.
const AXIS_CHAR_WIDTH = 7;
const AXIS_MIN_WIDTH = 36;

function computeAxisWidth(high: number, low: number): number {
  const widestLabelLength = Math.max(formatFiat(high)?.length ?? 0, formatFiat(low)?.length ?? 0);
  return Math.min(CHART_AXIS_WIDTH, Math.max(AXIS_MIN_WIDTH, widestLabelLength * AXIS_CHAR_WIDTH));
}

type DirectionFilter = 'all' | 'received' | 'sent';

const DIRECTION_FILTERS: FilterChipOption<DirectionFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Sent' },
];

// Same top/bottom-gutter mapping react-native-wagmi-charts uses internally for its
// Path and HorizontalLine, so these labels line up with what's actually plotted.
function computeAxisTicks(low: number, high: number) {
  const drawingHeight = CHART_HEIGHT - CHART_X_AXIS_RESERVED_HEIGHT;
  const heightBetweenGutters = drawingHeight - CHART_Y_GUTTER * 2;
  const range = high - low || 1;
  return Array.from({ length: AXIS_TICK_COUNT + 1 }, (_, i) => {
    const value = low + (range * i) / AXIS_TICK_COUNT;
    const percentageFromTop = (high - value) / range;
    return { value, y: CHART_Y_GUTTER + percentageFromTop * heightBetweenGutters };
  });
}

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
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');

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

  const visibleTransfers = useMemo(() => {
    if (directionFilter === 'all') return transfers;
    return transfers?.filter(
      (t) => isReceived(t, myAddresses) === (directionFilter === 'received'),
    );
  }, [transfers, directionFilter, myAddresses]);

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
  const chartPoints = points.map((p) => ({ timestamp: p.timestamp, value: p.price }));
  const isUp =
    chartPoints.length > 1
      ? (chartPoints[chartPoints.length - 1]?.value ?? 0) >= (chartPoints[0]?.value ?? 0)
      : true;
  const lineColor = isUp ? colors.success : colors.danger;
  const prices = chartPoints.map((p) => p.value);
  const maxPrice = prices.length > 0 ? Math.max(...prices) : undefined;
  const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;

  let chartContent;
  if (historyLoading) {
    chartContent = (
      <View style={styles.chartState} testID="asset-chart-skeleton">
        <Skeleton width="100%" height={CHART_HEIGHT - spacing.xl * 2} borderRadius={radius.lg} />
      </View>
    );
  } else if (historyError) {
    chartContent = (
      <View style={styles.chartState}>
        <AppText color="danger">Could not load price data</AppText>
        <TouchableOpacity
          testID="asset-chart-retry"
          style={styles.retryButton}
          onPress={() => refetchHistory()}
        >
          <AppText color="primary" style={styles.retryText}>Retry</AppText>
        </TouchableOpacity>
      </View>
    );
  } else if (!hasMarketData) {
    chartContent = (
      <View style={styles.chartState}>
        <Ionicons name="analytics-outline" size={40} color={colors.textSubtle} />
        <AppText color="textMuted" style={styles.noMarketText}>No market data</AppText>
      </View>
    );
  } else {
    // hasMarketData guarantees chartPoints (and therefore minPrice/maxPrice) is non-empty here.
    const high = maxPrice as number;
    const low = minPrice as number;
    const axisTicks = computeAxisTicks(low, high);
    // Shrinks the reserved gutter (and widens the plotted line into the freed space)
    // when this range's price labels are shorter than CHART_AXIS_WIDTH was sized for.
    const axisWidth = computeAxisWidth(high, low);
    const plotWidth = chartWidth - axisWidth;
    chartContent = (
      <View style={styles.chartWrapper}>
        <LineChart.Provider data={chartPoints}>
          <LineChart height={CHART_HEIGHT} width={plotWidth} yGutter={CHART_Y_GUTTER}>
            <LineChart.Path color={lineColor}>
              <LineChart.Gradient />
              <LineChart.HorizontalLine
                at={{ value: high }}
                color={colors.textSubtle}
                lineProps={{ strokeDasharray: '4 4' }}
              />
              <LineChart.HorizontalLine
                at={{ value: low }}
                color={colors.textSubtle}
                lineProps={{ strokeDasharray: '4 4' }}
              />
            </LineChart.Path>
            <LineChart.CursorCrosshair color={lineColor}>
              <LineChart.Tooltip textStyle={styles.tooltipText} />
            </LineChart.CursorCrosshair>
          </LineChart>
        </LineChart.Provider>
        <View style={[styles.axisLabels, { width: axisWidth }]} pointerEvents="none">
          {axisTicks.map((tick) => (
            <AppText
              key={tick.value}
              variant="caption"
              color="textMuted"
              style={[styles.axisTickText, { top: tick.y - 8 }]}
            >
              {formatFiat(tick.value)}
            </AppText>
          ))}
        </View>
        <AppText variant="caption" color="textMuted" style={styles.rangeLabelHigh}>
          {`High: ${formatFiat(high)}`}
        </AppText>
        <AppText variant="caption" color="textMuted" style={styles.rangeLabelLow}>
          {`Low: ${formatFiat(low)}`}
        </AppText>
      </View>
    );
  }

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

      <View style={styles.chartContainer}>{chartContent}</View>

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
          options={DIRECTION_FILTERS}
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
        keyExtractor={(item, index) => `${item.transactionHash}-${index}`}
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
  chartContainer: { height: CHART_HEIGHT, marginTop: spacing.lg, justifyContent: 'center' },
  chartState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  chartWrapper: { position: 'relative' },
  tooltipText: { color: colors.textPrimary, fontSize: 12 },
  axisLabels: { position: 'absolute', top: 0, right: 0, width: CHART_AXIS_WIDTH },
  axisTickText: { position: 'absolute', right: 0, textAlign: 'right' },
  rangeLabelHigh: { position: 'absolute', top: spacing.xs, left: spacing.xs },
  // Pinned just below the low dashed line's actual y position, not the box's bottom edge —
  // the box has extra height below that line reserved for the cursor's x-axis label.
  rangeLabelLow: {
    position: 'absolute',
    top: CHART_HEIGHT - CHART_X_AXIS_RESERVED_HEIGHT - CHART_Y_GUTTER + spacing.xs,
    left: spacing.xs,
  },
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
