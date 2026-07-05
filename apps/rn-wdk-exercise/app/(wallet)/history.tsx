import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useWallet } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/stores/authStore';
import { useAppNodeWalletSync } from '@/hooks/useAppNodeWalletSync';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { formatBalanceFromRaw, trimDisplayDecimals } from '@/utils/balance';

// Matches infra/wdk-stack's wdk-app-node schema (workers/lib/schemas/common.js `tokens` enum).
const TOKEN_DECIMALS: Record<string, number> = { usdt: 6, xaut: 6, usat: 6, btc: 8 };

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function formatDate(tsSeconds: number): string {
  const ms = tsSeconds > 1e12 ? tsSeconds : tsSeconds * 1000;
  return new Date(ms).toLocaleString();
}

function isReceived(transfer: TokenTransfer, myAddresses: string[]): boolean {
  if (transfer.type === 'received') return true;
  if (transfer.type === 'sent') return false;
  return myAddresses.some((addr) => addr.toLowerCase() === transfer.to?.toLowerCase());
}

export default function HistoryScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const ethereum = addresses['ethereum']?.[0];
  const bitcoin = addresses['bitcoin']?.[0];

  const { status: syncStatus, error: syncError } = useAppNodeWalletSync({ ethereum, bitcoin });
  const {
    data: transfers,
    isLoading,
    isError,
  } = useTransactionHistory(userId, syncStatus === 'done');

  const myAddresses = [ethereum, bitcoin].filter((a): a is string => Boolean(a));

  if (syncStatus === 'syncing' || (syncStatus === 'done' && isLoading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading history…</Text>
      </View>
    );
  }

  if (syncStatus === 'error' || isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {syncError ?? 'Could not load transaction history'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={transfers ?? []}
      keyExtractor={(item, index) => `${item.transactionHash}-${index}`}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.statusText}>No transactions yet</Text>
        </View>
      }
      renderItem={({ item }) => {
        const decimals = TOKEN_DECIMALS[item.token?.toLowerCase()] ?? 8;
        const amount = trimDisplayDecimals(
          formatBalanceFromRaw(item.amount, decimals) ?? '0',
          6,
        );
        const received = isReceived(item, myAddresses);

        return (
          <View style={styles.row}>
            <View>
              <Text style={styles.direction}>{received ? 'Received' : 'Sent'}</Text>
              <Text style={styles.meta}>
                {item.blockchain} · {item.token?.toUpperCase()}
              </Text>
              <Text style={styles.hash}>{truncateHash(item.transactionHash)}</Text>
              <Text style={styles.date}>{formatDate(item.ts)}</Text>
            </View>
            <Text style={[styles.amount, received ? styles.amountIn : styles.amountOut]}>
              {received ? '+' : '-'}
              {amount}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f9fafb', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  direction: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, color: '#888', marginTop: 2 },
  hash: { fontSize: 12, color: '#2563eb', marginTop: 4 },
  date: { fontSize: 11, color: '#aaa', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '600' },
  amountIn: { color: '#16a34a' },
  amountOut: { color: '#ef4444' },
  statusText: { color: '#888', marginTop: 12 },
  errorText: { color: '#ef4444', textAlign: 'center' },
});
