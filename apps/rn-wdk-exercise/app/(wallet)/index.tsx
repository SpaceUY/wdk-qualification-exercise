import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBalancesForWallet, useBalance, useWallet } from '@tetherto/wdk-react-native-core';
import { useWalletBootstrap } from '@/hooks/useWalletBootstrap';
import { useWalletData } from '@/hooks/useWalletData';
import { signOutFromCognito } from '@/hooks/useCognito';
import { useAuthStore } from '@/stores/authStore';
import { EVM_ASSETS, BTC_ASSET, SPARK_ASSET, USDT_TRON_ASSET, ALL_ASSET_CONFIGS, BTC_CONFIG, SPARK_CONFIG, USDT_TRON_CONFIG } from '@/config/assets';
import { isMainnetNetwork } from '@/config/networkMeta';
import { formatBalanceFromRaw, trimDisplayDecimals } from '@/utils/balance';
import { useWalletRegistration } from '@/hooks/useWalletRegistration';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { RowSkeleton } from '@/components/RowSkeleton';
import { NetworkDot } from '@/components/NetworkDot';

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.userId);
  const clearUserId = useAuthStore((s) => s.clear);
  const { status, error, retry } = useWalletBootstrap(userId);
  const { lock } = useWalletData();

  const { data: evmBalances, isLoading: evmLoading, refetch: refetchEvm } = useBalancesForWallet(
    0,
    EVM_ASSETS,
    { staleTime: 0, refetchInterval: 30_000 },
  );

  const { data: btcBalance, isLoading: btcLoading, refetch: refetchBtc } = useBalance(BTC_CONFIG.network, 0, BTC_ASSET, {
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: sparkBalance, isLoading: sparkLoading, refetch: refetchSpark } = useBalance(SPARK_CONFIG.network, 0, SPARK_ASSET, {
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const { data: tronBalance, isLoading: tronLoading, refetch: refetchTron } = useBalance(USDT_TRON_CONFIG.network, 0, USDT_TRON_ASSET, {
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const ethAddress = addresses['ethereum']?.[0];
  useWalletRegistration(ethAddress);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvm(), refetchBtc(), refetchSpark(), refetchTron()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchEvm, refetchBtc, refetchSpark, refetchTron]);

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
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Initializing wallet…</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>{error ?? 'Wallet failed to initialize'}</Text>
        <TouchableOpacity style={styles.button} onPress={retry}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const allBalances = [
    ...(evmBalances ?? []),
    ...(btcBalance ? [btcBalance] : []),
    ...(sparkBalance ? [sparkBalance] : []),
    ...(tronBalance ? [tronBalance] : []),
  ];
  // Built once per render instead of calling allBalances.find() inside renderItem — an O(1)
  // lookup per row instead of an O(n) scan per row (O(n²) total across the asset list).
  const balanceByAssetId = new Map(allBalances.map((b) => [b.assetId, b]));

  const isLoading = evmLoading || btcLoading || sparkLoading || tronLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
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
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {isLoading && allBalances.length === 0 ? (
        <FlatList
          testID="dashboard-balances-skeleton"
          data={ALL_ASSET_CONFIGS}
          keyExtractor={(item) => item.id}
          renderItem={() => <RowSkeleton testID="balance-row-skeleton" />}
          style={styles.list}
        />
      ) : (
      <FlatList
        testID="dashboard-balances"
        data={ALL_ASSET_CONFIGS}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => {
          const result = balanceByAssetId.get(item.id);
          const raw = result?.success ? result.balance : null;
          const formatted = raw != null ? trimDisplayDecimals(formatBalanceFromRaw(raw, item.decimals) ?? '0', 6) : '—';
          const isMainnet = isMainnetNetwork(item.network);

          return (
            // TouchableOpacity, not Pressable: NativeWind v4's component interop drops
            // Pressable's function-form `style` prop, so the row loses its card styles.
            <TouchableOpacity
              style={styles.balanceRow}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/(wallet)/history',
                  params: { network: item.network, symbol: item.symbol },
                })
              }
            >
              <View>
                <View style={styles.symbolRow}>
                  <NetworkDot network={item.network} />
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <View style={[styles.chip, isMainnet ? styles.chipMainnet : styles.chipTestnet]}>
                    <Text style={[styles.chipText, isMainnet ? styles.chipTextMainnet : styles.chipTextTestnet]}>
                      {isMainnet ? 'Mainnet' : 'Testnet'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.network}>{item.network}</Text>
              </View>
              <Text style={styles.balance}>{formatted}</Text>
            </TouchableOpacity>
          );
        }}
        style={styles.list}
      />
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => router.push('/(wallet)/send')}
        >
          <Ionicons name="arrow-up" size={16} color={colors.textOnPrimary} />
          <Text style={styles.actionButtonLabel}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => router.push('/(wallet)/receive')}
        >
          <Ionicons name="arrow-down" size={16} color={colors.textOnPrimary} />
          <Text style={styles.actionButtonLabel}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(wallet)/wallet-setup')}
        >
          <Ionicons name="key-outline" size={16} color={colors.primary} />
          <Text style={[styles.actionButtonLabel, styles.actionButtonLabelSecondary]}>Seed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(wallet)/cashback')}
        >
          <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
          <Text style={[styles.actionButtonLabel, styles.actionButtonLabelSecondary]}>Cashback</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(wallet)/history')}
        >
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={[styles.actionButtonLabel, styles.actionButtonLabelSecondary]}>History</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  logoutText: { color: colors.danger, fontSize: 14 },
  list: { flex: 1, marginTop: 8 },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 10,
  },
  symbol: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  network: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  chipMainnet: { backgroundColor: colors.successBg },
  chipTestnet: { backgroundColor: colors.warningBg },
  chipText: { fontSize: 10, fontWeight: '700' },
  chipTextMainnet: { color: colors.successText },
  chipTextTestnet: { color: colors.warningText },
  balance: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  actions: {
    flexDirection: 'row',
    padding: 10,
    gap: 6,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionButtonPrimary: { backgroundColor: colors.primary },
  actionButtonSecondary: { backgroundColor: colors.primarySoft },
  actionButtonLabel: { color: colors.textOnPrimary, fontWeight: '600', fontSize: 10 },
  actionButtonLabelSecondary: { color: colors.primary },
  buttonText: { color: colors.textOnPrimary, fontWeight: '600', fontSize: 15 },
  statusText: { color: colors.textMuted, marginTop: 12 },
  errorText: { color: colors.danger, marginBottom: 16, textAlign: 'center' },
});