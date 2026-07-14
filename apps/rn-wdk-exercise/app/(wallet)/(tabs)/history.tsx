import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleHelp, Receipt } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { useFilteredTransactionHistory } from '@/hooks/useFilteredTransactionHistory';
import { useDirectionFilter } from '@/hooks/useDirectionFilter';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { getNetworkDisplayName, isHistorySupportedNetwork } from '@/config/networkMeta';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { gradients } from '@/theme/gradients';
import { AppText, FilterChips } from '@/components/ui';
import { Header, HeaderIconButton } from '@/components/Header';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/GlassTabBar';
import { TransferDetailModal } from '@/components/TransferDetailModal';
import { RowSkeleton } from '@/components/RowSkeleton';
import { TransferRow } from '@/components/TransferRow';
import { FILTER_OVERLAY_HEIGHT, LIST_CONTENT_TOP_PADDING } from '@/app/(wallet)/(tabs)/listLayout';

const LOADING_SKELETON_ROWS = 6;

// The transfers refetch is a single backend GET that often resolves in tens of
// milliseconds — too fast for the spinner to register as feedback. Keep it up at
// least this long so the pull gesture always gets a visible confirmation.
const MIN_REFRESH_SPINNER_MS = 400;

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { network, symbol } = useLocalSearchParams<{ network?: string; symbol?: string }>();
  const { transfers, isLoading, isError, syncStatus, retry, myAddresses, refetch } =
    useFilteredTransactionHistory({ network, symbol });
  const [selected, setSelected] = useState<TokenTransfer | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_SPINNER_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  const { gesture: pullGesture, handleScroll } = usePullToRefresh(handleRefresh, refreshing);
  const {
    filter: directionFilter,
    setFilter: setDirectionFilter,
    options: directionOptions,
    visibleTransfers,
  } = useDirectionFilter(transfers, myAddresses);

  let content;
  if (syncStatus === 'syncing' || (syncStatus === 'done' && isLoading)) {
    content = (
      <View style={styles.skeletonList} testID="history-skeleton">
        {Array.from({ length: LOADING_SKELETON_ROWS }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </View>
    );
  } else if (syncStatus === 'error' || isError) {
    content = (
      <View style={styles.center}>
        <AppText color="danger" style={styles.errorText}>
          Something went wrong. Please try again.
        </AppText>
        <TouchableOpacity testID="history-retry" style={styles.emptyCta} onPress={retry}>
          <AppText color="primary" style={styles.emptyCtaText}>Retry</AppText>
        </TouchableOpacity>
      </View>
    );
  } else {
    content = (
      // Same no-<RefreshControl> pull-to-refresh as the dashboard list: the
      // gesture is driven by usePullToRefresh, with the header spinner as the
      // only loading feedback.
      <GestureDetector gesture={pullGesture}>
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          data={visibleTransfers ?? []}
          keyExtractor={(item) => `${item.transactionHash}-${item.from}-${item.to}-${item.amount}-${item.ts}`}
          ListEmptyComponent={
            <View style={styles.center}>
              <Receipt size={40} color={colors.textSubtle} />
              <AppText color="textMuted" style={styles.statusText}>No transactions yet</AppText>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push('/(wallet)/receive')}
              >
                <AppText color="primary" style={styles.emptyCtaText}>Receive funds</AppText>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TransferRow
              transfer={item}
              myAddresses={myAddresses}
              variant="history"
              onPress={() => setSelected(item)}
            />
          )}
        />
      </GestureDetector>
    );
  }

  const comingSoonMessage = network
    ? !isHistorySupportedNetwork(network)
      ? `Transaction history for ${getNetworkDisplayName(network)} isn't tracked yet — coming soon.`
      : null
    : 'Transaction history currently covers USDT on Ethereum and Bitcoin only — other assets and networks are coming soon.';

  return (
    // No bottom edge: the list scrolls behind the floating glass tab bar, with
    // TAB_BAR_CLEARANCE padding keeping the last row reachable.
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Header
        left={
          <View style={styles.titleRow}>
            <AppText variant="title">{symbol ? `History · ${symbol}` : 'History'}</AppText>
            {refreshing && (
              <ActivityIndicator testID="history-refresh-indicator" size="small" color={colors.textMuted} />
            )}
          </View>
        }
        right={
          comingSoonMessage ? (
            <HeaderIconButton
              testID="history-help"
              icon={CircleHelp}
              accessibilityLabel="Coverage info"
              onPress={() => toast.info('Coming soon', { description: comingSoonMessage })}
            />
          ) : null
        }
      />
      <View style={styles.listArea}>
        {content}

        {/* Floating filter row with a gradient fading to transparent behind it, so
            rows scrolling underneath dissolve into the background instead of hitting
            a hard edge — same treatment as the dashboard's network filter. */}
        <View style={styles.filterOverlay} pointerEvents="box-none">
          <LinearGradient
            colors={gradients.listFade}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <FilterChips
            options={directionOptions}
            value={directionFilter}
            onChange={setDirectionFilter}
            testIDPrefix="history-filter"
            style={styles.filterChips}
          />
        </View>
      </View>

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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listArea: { flex: 1 },
  list: { flex: 1 },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    // Clears the floating filter row; see LIST_CONTENT_TOP_PADDING.
    paddingTop: LIST_CONTENT_TOP_PADDING,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FILTER_OVERLAY_HEIGHT,
  },
  // Tightens the gap below the header (FilterChips' own default is spacing.lg).
  filterChips: { marginTop: spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  skeletonList: { paddingTop: LIST_CONTENT_TOP_PADDING, paddingBottom: spacing.md },
  statusText: { marginTop: spacing.md },
  errorText: { textAlign: 'center' },
  emptyCta: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  emptyCtaText: { fontWeight: '600' },
});
