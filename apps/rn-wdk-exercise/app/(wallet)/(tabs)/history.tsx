import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownLeft, ArrowUpRight, CircleHelp, Receipt } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { trimDisplayDecimals } from '@/utils/balance';
import { formatTransferDate, isReceived } from '@/utils/transfers';
import { useFilteredTransactionHistory } from '@/hooks/useFilteredTransactionHistory';
import { getNetworkDisplayName, isHistorySupportedNetwork } from '@/config/networkMeta';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText, FilterChips, type FilterChipOption } from '@/components/ui';
import { Header, HeaderIconButton } from '@/components/Header';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/GlassTabBar';
import { TransferDetailModal } from '@/components/TransferDetailModal';
import { RowSkeleton } from '@/components/RowSkeleton';
import { TokenLogo } from '@/components/TokenLogo';

const LOADING_SKELETON_ROWS = 6;

type DirectionFilter = 'all' | 'received' | 'sent';

const DIRECTION_FILTERS: FilterChipOption<DirectionFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Sent' },
];

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { network, symbol } = useLocalSearchParams<{ network?: string; symbol?: string }>();
  const { transfers, isLoading, isError, syncStatus, syncError, myAddresses } =
    useFilteredTransactionHistory({ network, symbol });
  const [selected, setSelected] = useState<TokenTransfer | null>(null);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');

  const visibleTransfers = useMemo(() => {
    if (directionFilter === 'all') return transfers;
    return transfers?.filter(
      (t) => isReceived(t, myAddresses) === (directionFilter === 'received'),
    );
  }, [transfers, directionFilter, myAddresses]);

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
          {syncError ?? 'Could not load transaction history'}
        </AppText>
      </View>
    );
  } else {
    content = (
      <FlatList
        contentContainerStyle={styles.container}
        data={visibleTransfers ?? []}
        keyExtractor={(item, index) => `${item.transactionHash}-${index}`}
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
      <FilterChips
        options={DIRECTION_FILTERS}
        value={directionFilter}
        onChange={setDirectionFilter}
        testIDPrefix="history-filter"
      />
      {content}

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
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  skeletonList: { paddingVertical: spacing.md },
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
