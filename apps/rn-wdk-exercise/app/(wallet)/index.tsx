import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBalancesForWallet, useBalance, useWallet } from '@tetherto/wdk-react-native-core';
import { useWalletBootstrap } from '@/hooks/useWalletBootstrap';
import { useAuthStore } from '@/stores/authStore';
import { EVM_ASSETS, BTC_ASSET, SPARK_ASSET, USDT_TRON_ASSET, ALL_ASSET_CONFIGS, BTC_CONFIG, SPARK_CONFIG, USDT_TRON_CONFIG, NETWORK_IS_MAINNET } from '@/config/assets';
import { formatBalanceFromRaw, trimDisplayDecimals } from '@/utils/balance';
import { putWalletAddress } from '@/utils/api';

export default function DashboardScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const clearUserId = useAuthStore((s) => s.clear);
  const { status, error, retry } = useWalletBootstrap(userId);
  const registeredRef = useRef(false);

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

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvm(), refetchBtc(), refetchSpark(), refetchTron()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchEvm, refetchBtc, refetchSpark, refetchTron]);

  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const ethAddress = addresses['ethereum']?.[0];

  useEffect(() => {
    if (!ethAddress || registeredRef.current) return;
    registeredRef.current = true;
    putWalletAddress(ethAddress).catch(() => {
      registeredRef.current = false;
    });
  }, [ethAddress]);

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

  const isLoading = evmLoading || btcLoading || sparkLoading || tronLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
        <TouchableOpacity
          testID="dashboard-logout"
          onPress={() => {
            clearUserId();
            router.replace('/(auth)');
          }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {isLoading && allBalances.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : null}

      <FlatList
        testID="dashboard-balances"
        data={ALL_ASSET_CONFIGS}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => {
          const result = allBalances.find((b) => b.assetId === item.id);
          const raw = result?.success ? result.balance : null;
          const formatted = raw != null ? trimDisplayDecimals(formatBalanceFromRaw(raw, item.decimals) ?? '0', 6) : '—';
          const isMainnet = NETWORK_IS_MAINNET[item.network] ?? false;

          return (
            <View style={styles.balanceRow}>
              <View>
                <View style={styles.symbolRow}>
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
            </View>
          );
        }}
        style={styles.list}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => router.push('/(wallet)/send')}
        >
          <Ionicons name="arrow-up" size={16} color="#fff" />
          <Text style={styles.actionButtonLabel}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => router.push('/(wallet)/receive')}
        >
          <Ionicons name="arrow-down" size={16} color="#fff" />
          <Text style={styles.actionButtonLabel}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(wallet)/wallet-setup')}
        >
          <Ionicons name="key-outline" size={16} color="#2563eb" />
          <Text style={[styles.actionButtonLabel, styles.actionButtonLabelSecondary]}>Seed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(wallet)/cashback')}
        >
          <Ionicons name="pricetag-outline" size={16} color="#2563eb" />
          <Text style={[styles.actionButtonLabel, styles.actionButtonLabelSecondary]}>Cashback</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(wallet)/history')}
        >
          <Ionicons name="time-outline" size={16} color="#2563eb" />
          <Text style={[styles.actionButtonLabel, styles.actionButtonLabelSecondary]}>History</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 22, fontWeight: '700' },
  logoutText: { color: '#ef4444', fontSize: 14 },
  list: { flex: 1, marginTop: 8 },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 10,
  },
  symbol: { fontSize: 16, fontWeight: '600' },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  network: { fontSize: 12, color: '#888', marginTop: 2 },
  chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  chipMainnet: { backgroundColor: '#dcfce7' },
  chipTestnet: { backgroundColor: '#fef3c7' },
  chipText: { fontSize: 10, fontWeight: '700' },
  chipTextMainnet: { color: '#15803d' },
  chipTextTestnet: { color: '#b45309' },
  balance: { fontSize: 16, fontWeight: '500' },
  actions: {
    flexDirection: 'row',
    padding: 10,
    gap: 6,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    backgroundColor: '#2563eb',
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
  actionButtonPrimary: { backgroundColor: '#2563eb' },
  actionButtonSecondary: { backgroundColor: '#eff6ff' },
  actionButtonLabel: { color: '#fff', fontWeight: '600', fontSize: 10 },
  actionButtonLabelSecondary: { color: '#2563eb' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  statusText: { color: '#888', marginTop: 12 },
  errorText: { color: '#ef4444', marginBottom: 16, textAlign: 'center' },
});