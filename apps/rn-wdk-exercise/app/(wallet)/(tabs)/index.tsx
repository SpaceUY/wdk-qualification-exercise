import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useWallet } from '@tetherto/wdk-react-native-core';
import { useWalletBootstrap } from '@/hooks/useWalletBootstrap';
import { useAssetBalances } from '@/hooks/useAssetBalances';
import { usePrices } from '@/hooks/usePrices';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import { useWalletRegistration } from '@/hooks/useWalletRegistration';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { gradients } from '@/theme/gradients';
import { spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';
import { AssetRow, BalanceHeroView, buildAssetRows, NetworkFilterChips, type NetworkFilter } from '@/components/balance';
import { RowSkeleton } from '@/components/RowSkeleton';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/GlassTabBar';
import { Header, HeaderIconButton } from '@/components/Header';

// Height of the floating filter row + its fade tail — the overlay below is this
// tall so the gradient has room to fade out before the chips.
const FILTER_OVERLAY_HEIGHT = 72;
// List content's own top padding is shorter than the overlay on purpose: the first
// row starts inside the gradient's fade tail instead of fully clearing it, so the
// gap to the filter row reads tighter while the fade still softens the overlap.
const LIST_CONTENT_TOP_PADDING = 64;

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.userId);
  const isBalanceHidden = useSettingsStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useSettingsStore((s) => s.toggleBalanceHidden);
  const { status, error, retry } = useWalletBootstrap(userId);

  const { balanceByAssetId, hasAnyBalance, isLoading, refetchAll } = useAssetBalances();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const ethAddress = addresses['ethereum']?.[0];
  useWalletRegistration(ethAddress);

  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll]);
  const { gesture: pullGesture, handleScroll } = usePullToRefresh(handleRefresh, refreshing);

  const settledRefetchRan = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || settledRefetchRan.current) return;
    settledRefetchRan.current = true;
    // Right after the wallet finishes unlocking, WDK's underlying account/provider context
    // can still be warming up - the very first balance fetch can silently succeed with a
    // stale/zero value. One delayed refetch (the same thing pull-to-refresh already does)
    // catches that without making the user wait for the 30-60s auto refetchInterval.
    const timeout = setTimeout(() => { handleRefresh(); }, 2000);
    return () => clearTimeout(timeout);
  }, [status, handleRefresh]);

  if (status === 'loading' || status === 'idle') {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText color="textMuted" style={styles.statusText}>Initializing wallet…</AppText>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <AppText color="danger" style={styles.errorText}>{error ?? 'Wallet failed to initialize'}</AppText>
        <Button title="Retry" onPress={retry} style={styles.retryButton} />
      </SafeAreaView>
    );
  }

  const { rows, totalFiat } = buildAssetRows(ALL_ASSET_CONFIGS, balanceByAssetId, pricesData?.prices);
  const filteredRows = rows.filter((row) => {
    if (networkFilter === 'all') return true;
    return networkFilter === 'mainnet' ? row.isMainnet : !row.isMainnet;
  });

  return (
    // No bottom edge: list content scrolls behind the floating glass tab bar,
    // with TAB_BAR_CLEARANCE padding keeping the last row reachable.
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        left={
          <View style={styles.brand}>
            <Image source={require('@/assets/icon.png')} style={styles.brandLogo} />
            <AppText variant="title">Northstar</AppText>
          </View>
        }
        right={
          <HeaderIconButton
            testID="dashboard-settings"
            icon={Settings}
            accessibilityLabel="Settings"
            onPress={() => router.push('/(wallet)/settings')}
          />
        }
      />

      <BalanceHeroView
        totalFiat={totalFiat}
        isLoading={pricesLoading || (isLoading && !hasAnyBalance)}
        hidden={isBalanceHidden}
        onToggleHidden={toggleBalanceHidden}
        onSendPress={() => router.push('/(wallet)/send')}
        onReceivePress={() => router.push('/(wallet)/receive')}
        onCashbackPress={() => router.push('/(wallet)/cashback')}
      />

      <View style={styles.sectionTitleRow}>
        <AppText variant="subtitle" style={styles.sectionTitle}>My Tokens</AppText>
        {refreshing && (
          <ActivityIndicator testID="dashboard-refresh-indicator" size="small" color={colors.textMuted} />
        )}
      </View>

      <View style={styles.listArea}>
        {isLoading && !hasAnyBalance ? (
          <FlatList
            testID="dashboard-balances-skeleton"
            data={ALL_ASSET_CONFIGS}
            keyExtractor={(item) => item.id}
            renderItem={() => <RowSkeleton testID="balance-row-skeleton" />}
            style={styles.list}
            contentContainerStyle={[styles.listContent, styles.listContentWithFilter]}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          // No <RefreshControl>: it always draws native chrome (iOS reserves
          // space for its spinner while dragging, Android always paints its own
          // disc) that can't be fully hidden by tinting. usePullToRefresh drives
          // the same pull-down-and-release gesture ourselves instead, with the
          // "My Tokens" indicator above as the only loading feedback.
          <GestureDetector gesture={pullGesture}>
            <FlatList
              testID="dashboard-balances"
              data={filteredRows}
              keyExtractor={(item) => item.id}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <AssetRow
                  asset={item}
                  hidden={isBalanceHidden}
                  onPress={() =>
                    router.push({
                      pathname: '/(wallet)/history',
                      params: { network: item.network, symbol: item.symbol },
                    })
                  }
                />
              )}
              style={styles.list}
              contentContainerStyle={[styles.listContent, styles.listContentWithFilter]}
              showsVerticalScrollIndicator={false}
            />
          </GestureDetector>
        )}

        <View style={styles.filterOverlay} pointerEvents="box-none">
          <LinearGradient
            colors={gradients.listFade}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <NetworkFilterChips value={networkFilter} onChange={setNetworkFilter} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandLogo: { width: 28, height: 28, borderRadius: 8 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: { opacity: 0.7 },
  // Filter row floats over this (position: 'absolute'), so it needs to be the
  // positioning context for its top/left/right anchoring.
  listArea: { flex: 1, position: 'relative' },
  list: { flex: 1 },
  // TAB_BAR_CLEARANCE alone clears the floating tab bar exactly; the extra
  // spacing.lg gives visible breathing room past it at max scroll.
  listContent: { paddingBottom: TAB_BAR_CLEARANCE + spacing.lg },
  // Clears most of the floating filter row; see LIST_CONTENT_TOP_PADDING.
  listContentWithFilter: { paddingTop: LIST_CONTENT_TOP_PADDING },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FILTER_OVERLAY_HEIGHT,
  },
  retryButton: { alignSelf: 'stretch' },
  statusText: { marginTop: spacing.md },
  errorText: { marginBottom: spacing.lg, textAlign: 'center' },
});
