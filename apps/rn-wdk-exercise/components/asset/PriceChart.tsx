import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-wagmi-charts';
import type { PriceHistoryPoint } from '@/utils/api';
import { formatFiat } from '@/utils/balance';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Skeleton } from '@/components/ui';

// Fixed height so the layout doesn't jump between skeleton, chart, and no-data states.
const CHART_HEIGHT = 280;
const CHART_Y_GUTTER = spacing.xxl;
// Reserved margin on the right for price labels, kept clear of the plotted line.
const CHART_AXIS_WIDTH = 70;
// Mirrors react-native-wagmi-charts' internal reserved space for cursor labels at the bottom.
const CHART_X_AXIS_RESERVED_HEIGHT = 40;
const AXIS_TICK_COUNT = 4;
// Rough width of one glyph at the axis labels' caption font size (13px).
const AXIS_CHAR_WIDTH = 7;
const AXIS_MIN_WIDTH = 36;

function computeAxisWidth(high: number, low: number): number {
  const widestLabelLength = Math.max(formatFiat(high)?.length ?? 0, formatFiat(low)?.length ?? 0);
  return Math.min(CHART_AXIS_WIDTH, Math.max(AXIS_MIN_WIDTH, widestLabelLength * AXIS_CHAR_WIDTH));
}

// Same top/bottom-gutter mapping react-native-wagmi-charts uses internally, so these
// labels line up with what's actually plotted.
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

export type PriceChartProps = {
  points: PriceHistoryPoint[];
  hasMarketData: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  // Container width the SVG should fill (screen width minus horizontal padding).
  width: number;
};

// Presentational price chart: owns wagmi-charts geometry and the loading/error/
// no-data/chart branches previously inlined in asset/[id].tsx.
export function PriceChart({ points, hasMarketData, isLoading, isError, onRetry, width }: PriceChartProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  if (isLoading) {
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartState} testID="asset-chart-skeleton">
          <Skeleton width="100%" height={CHART_HEIGHT - spacing.xl * 2} borderRadius={radius.lg} />
        </View>
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartState}>
          <AppText color="danger">Could not load price data</AppText>
          <TouchableOpacity testID="asset-chart-retry" style={styles.retryButton} onPress={onRetry}>
            <AppText color="primary" style={styles.retryText}>Retry</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  if (!hasMarketData) {
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartState}>
          <Ionicons name="analytics-outline" size={40} color={colors.textSubtle} />
          <AppText color="textMuted" style={styles.noMarketText}>No market data</AppText>
        </View>
      </View>
    );
  }

  const chartPoints = points.map((p) => ({ timestamp: p.timestamp, value: p.price }));
  const prices = chartPoints.map((p) => p.value);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const isUp =
    chartPoints.length > 1
      ? (chartPoints[chartPoints.length - 1]?.value ?? 0) >= (chartPoints[0]?.value ?? 0)
      : true;
  const lineColor = isUp ? colors.success : colors.danger;
  const axisTicks = computeAxisTicks(low, high);
  const axisWidth = computeAxisWidth(high, low);
  const plotWidth = width - axisWidth;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartWrapper}>
        <LineChart.Provider data={chartPoints}>
          <LineChart height={CHART_HEIGHT} width={plotWidth} yGutter={CHART_Y_GUTTER}>
            <LineChart.Path color={lineColor}>
              <LineChart.Gradient />
              <LineChart.HorizontalLine at={{ value: high }} color={colors.textSubtle} lineProps={{ strokeDasharray: '4 4' }} />
              <LineChart.HorizontalLine at={{ value: low }} color={colors.textSubtle} lineProps={{ strokeDasharray: '4 4' }} />
            </LineChart.Path>
            <LineChart.CursorCrosshair color={lineColor}>
              <LineChart.Tooltip textStyle={styles.tooltipText} />
            </LineChart.CursorCrosshair>
          </LineChart>
        </LineChart.Provider>
        <View style={[styles.axisLabels, { width: axisWidth }]} pointerEvents="none">
          {axisTicks.map((tick) => (
            <AppText key={tick.value} variant="caption" color="textMuted" style={[styles.axisTickText, { top: tick.y - 8 }]}>
              {formatFiat(tick.value)}
            </AppText>
          ))}
        </View>
        <AppText variant="caption" color="textMuted" style={styles.rangeLabelHigh}>{`High: ${formatFiat(high)}`}</AppText>
        <AppText variant="caption" color="textMuted" style={styles.rangeLabelLow}>{`Low: ${formatFiat(low)}`}</AppText>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  chartContainer: { height: CHART_HEIGHT, marginTop: spacing.lg, justifyContent: 'center' },
  chartState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  chartWrapper: { position: 'relative' },
  tooltipText: { color: colors.textPrimary, fontSize: 12 },
  axisLabels: { position: 'absolute', top: 0, right: 0, width: CHART_AXIS_WIDTH },
  axisTickText: { position: 'absolute', right: 0, textAlign: 'right' },
  rangeLabelHigh: { position: 'absolute', top: spacing.xs, left: spacing.xs },
  rangeLabelLow: {
    position: 'absolute',
    top: CHART_HEIGHT - CHART_X_AXIS_RESERVED_HEIGHT - CHART_Y_GUTTER + spacing.xs,
    left: spacing.xs,
  },
  noMarketText: { marginTop: spacing.md },
  retryButton: { marginTop: spacing.md },
  retryText: { fontWeight: '600' },
});
