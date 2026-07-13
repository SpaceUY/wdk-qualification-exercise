import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWallet } from '@tetherto/wdk-react-native-core';
import { useWalletBootstrap } from '@/hooks/useWalletBootstrap';
import { useAssetBalances } from '@/hooks/useAssetBalances';
import { usePrices } from '@/hooks/usePrices';
import { useWalletData } from '@/hooks/useWalletData';
import { signOutFromCognito } from '@/hooks/useCognito';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import { useWalletRegistration } from '@/hooks/useWalletRegistration';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';
import { AssetRow, BalanceHeroView, buildAssetRows } from '@/components/balance';
import { RowSkeleton } from '@/components/RowSkeleton';
import { TAB_BAR_CLEARANCE } from '@/components/navigation/GlassTabBar';

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.userId);
  const clearUserId = useAuthStore((s) => s.clear);
  const isBalanceHidden = useSettingsStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useSettingsStore((s) => s.toggleBalanceHidden);
  const { status, error, retry } = useWalletBootstrap(userId);
  const { lock } = useWalletData();

  const { balanceByAssetId, hasAnyBalance, isLoading, refetchAll } = useAssetBalances();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const ethAddress = addresses['ethereum']?.[0];
  useWalletRegistration(ethAddress);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll]);

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

  return (
    // No bottom edge: list content scrolls behind the floating glass tab bar,
    // with TAB_BAR_CLEARANCE padding keeping the last row reachable.
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="title">Wallet</AppText>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="dashboard-seed"
            hitSlop={8}
            onPress={() => router.push('/(wallet)/wallet-setup')}
          >
            <Ionicons name="key-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="dashboard-cashback"
            hitSlop={8}
            onPress={() => router.push('/(wallet)/cashback')}
          >
            <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="dashboard-logout"
            onPress={async () => {
              // Unloads the current wallet's seed from the WDK worklet and clears
              // activeWalletId - without this, a different user logging in afterwards can
              // read balances fetched against this wallet's still-loaded seed.
              lock();
              await signOutFromCognito();
              clearUserId();
              router.replace('/(auth)');
            }}
          >
            <AppText variant="caption" color="danger">Logout</AppText>
          </TouchableOpacity>
        </View>
      </View>

      <BalanceHeroView
        totalFiat={totalFiat}
        isLoading={pricesLoading || (isLoading && !hasAnyBalance)}
        hidden={isBalanceHidden}
        onToggleHidden={toggleBalanceHidden}
      />

      {isLoading && !hasAnyBalance ? (
        <FlatList
          testID="dashboard-balances-skeleton"
          data={ALL_ASSET_CONFIGS}
          keyExtractor={(item) => item.id}
          renderItem={() => <RowSkeleton testID="balance-row-skeleton" />}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          testID="dashboard-balances"
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textMuted} />}
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
          contentContainerStyle={styles.listContent}
        />
      )}

    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  list: { flex: 1, marginTop: spacing.sm },
  listContent: { paddingBottom: TAB_BAR_CLEARANCE },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  retryButton: { alignSelf: 'stretch' },
  statusText: { marginTop: spacing.md },
  errorText: { marginBottom: spacing.lg, textAlign: 'center' },
});
