import { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowDownLeft, ArrowUpRight, CircleHelp, Receipt } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { trimDisplayDecimals } from '@/utils/balance';
import { formatTransferDate, isReceived } from '@/utils/transfers';
import { useFilteredTransactionHistory } from '@/hooks/useFilteredTransactionHistory';
import { useDirectionFilter } from '@/hooks/useDirectionFilter';
import { getNetworkDisplayName, isHistorySupportedNetwork } from '@/config/networkMeta';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { gradients } from '@/theme/gradients';
import { AppText, FilterChips } from '@/components/ui';
import { Header, HeaderIconButton } from '@/components/Header';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/GlassTabBar';
import { TransferDetailModal } from '@/components/TransferDetailModal';
import { RowSkeleton } from '@/components/RowSkeleton';
import { TokenLogo } from '@/components/TokenLogo';

const LOADING_SKELETON_ROWS = 6;
// Height of the floating filter row + its fade tail — the gradient overlay is this
// tall so it can fade out below the chips. Mirrors the dashboard's filter treatment.
const FILTER_OVERLAY_HEIGHT = 72;
// List/skeleton content starts inside the gradient's fade tail so the first row sits
// close under the filter row while the fade still softens the overlap.
const LIST_CONTENT_TOP_PADDING = 64;

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { network, symbol } = useLocalSearchParams<{ network?: string; symbol?: string }>();
  const { transfers, isLoading, isError, syncStatus, retry, myAddresses } =
    useFilteredTransactionHistory({ network, symbol });
  const [selected, setSelected] = useState<TokenTransfer | null>(null);
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
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
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
        renderItem={({ item }) => {
          const amount = trimDisplayDecimals(item.amount || '0', 6);
          const received = isReceived(item, myAddresses);

          return (
            // TouchableOpacity, not Pressable: NativeWind v4's component interop drops
            // Pressable's function-form `style` prop, so the row loses its card styles.
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => setSelected(item)}
            >
              <View style={styles.rowLeft}>
                <View style={styles.avatar}>
                  <View style={styles.directionCircle}>
                    {received ? (
                      <ArrowDownLeft size={20} color={colors.success} strokeWidth={2.5} />
                    ) : (
                      <ArrowUpRight size={20} color={colors.danger} strokeWidth={2.5} />
                    )}
                  </View>
                  {/* Token badge, overlapping the bottom-right edge of the direction icon. */}
                  <View style={styles.tokenBadge}>
                    <TokenLogo symbol={item.token?.toUpperCase() ?? ''} size={18} />
                  </View>
                </View>
                <View style={styles.info}>
                  <AppText style={styles.itemTitle}>
                    {received ? 'Receive' : 'Send'} {item.token?.toUpperCase()} on {item.blockchain}
                  </AppText>
                  <AppText variant="caption" color="textSubtle" style={styles.date}>
                    {formatTransferDate(item.ts)}
                  </AppText>
                </View>
              </View>
              <AppText variant="mono" color={received ? 'success' : 'textPrimary'}>
                {received ? '+' : '-'}
                {amount}
              </AppText>
            </TouchableOpacity>
          );
        }}
      />
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
        left={<AppText variant="title">{symbol ? `History · ${symbol}` : 'History'}</AppText>}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatar: { width: 40, height: 40 },
  directionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    borderRadius: 12,
    // Ring in the card's own color so the badge reads as sitting on top of the
    // direction icon rather than merging into it.
    borderWidth: 2,
    borderColor: colors.surface,
  },
  info: { flex: 1 },
  itemTitle: { fontWeight: '600' },
  date: { marginTop: 2 },
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
