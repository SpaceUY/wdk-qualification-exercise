import { useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useBalancesForWallet, useBalance, useWallet } from '@tetherto/wdk-react-native-core';
import { useWalletBootstrap } from '@/hooks/useWalletBootstrap';
import { useAuthStore } from '@/stores/authStore';
import { EVM_ASSETS, BTC_ASSET, SPARK_ASSET, USDT_TRON_ASSET, ALL_ASSET_CONFIGS, BTC_CONFIG, SPARK_CONFIG, USDT_TRON_CONFIG } from '@/config/assets';
import { formatBalanceFromRaw, trimDisplayDecimals } from '@/utils/balance';
import { putWalletAddress } from '@/utils/api';

export default function DashboardScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const clearUserId = useAuthStore((s) => s.clear);
  const { status, error, retry } = useWalletBootstrap(userId);
  const registeredRef = useRef(false);

  const { data: evmBalances, isLoading: evmLoading } = useBalancesForWallet(
    0,
    EVM_ASSETS,
    { staleTime: 0, refetchInterval: 30_000 },
  );

  const { data: btcBalance, isLoading: btcLoading } = useBalance(BTC_CONFIG.network, 0, BTC_ASSET, {
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: sparkBalance, isLoading: sparkLoading } = useBalance(SPARK_CONFIG.network, 0, SPARK_ASSET, {
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const { data: tronBalance, isLoading: tronLoading } = useBalance(USDT_TRON_CONFIG.network, 0, USDT_TRON_ASSET, {
    staleTime: 0,
    refetchInterval: 60_000,
  });

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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Initializing wallet…</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Wallet failed to initialize'}</Text>
        <TouchableOpacity style={styles.button} onPress={retry}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
        <TouchableOpacity
          onPress={() => {
            clearUserId();
            router.replace('/(auth)');
          }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {ethAddress ? (
        <Text style={styles.address} numberOfLines={1} ellipsizeMode="middle">
          {ethAddress}
        </Text>
      ) : null}

      {isLoading && allBalances.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : null}

      <FlatList
        data={ALL_ASSET_CONFIGS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const result = allBalances.find((b) => b.assetId === item.id);
          const raw = result?.success ? result.balance : null;
          const formatted = raw != null ? trimDisplayDecimals(formatBalanceFromRaw(raw, item.decimals) ?? '0', 6) : '—';

          return (
            <View style={styles.balanceRow}>
              <View>
                <Text style={styles.symbol}>{item.symbol}</Text>
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
          style={[styles.button, styles.actionButton]}
          onPress={() => router.push('/(wallet)/send')}
        >
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={() => router.push('/(wallet)/receive')}
        >
          <Text style={styles.buttonText}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.actionButton, styles.secondaryButton]}
          onPress={() => router.push('/(wallet)/wallet-setup')}
        >
          <Text style={[styles.buttonText, { color: '#2563eb' }]}>Seed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.actionButton, styles.secondaryButton]}
          onPress={() => router.push('/(wallet)/cashback')}
        >
          <Text style={[styles.buttonText, { color: '#2563eb' }]}>Cashback</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    paddingTop: 56,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 22, fontWeight: '700' },
  logoutText: { color: '#ef4444', fontSize: 14 },
  address: { fontSize: 11, color: '#888', marginHorizontal: 20, marginVertical: 8 },
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
  network: { fontSize: 12, color: '#888', marginTop: 2 },
  balance: { fontSize: 16, fontWeight: '500' },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
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
  actionButton: { flex: 1 },
  secondaryButton: { backgroundColor: '#eff6ff' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  statusText: { color: '#888', marginTop: 12 },
  errorText: { color: '#ef4444', marginBottom: 16, textAlign: 'center' },
});
