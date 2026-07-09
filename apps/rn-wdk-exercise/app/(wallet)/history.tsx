import { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { trimDisplayDecimals } from '@/utils/balance';
import { formatTransferDate, isReceived, truncateHash } from '@/utils/transfers';
import { useFilteredTransactionHistory } from '@/hooks/useFilteredTransactionHistory';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TransferDetailModal } from '@/components/TransferDetailModal';
import { RowSkeleton } from '@/components/RowSkeleton';
import { NetworkDot } from '@/components/NetworkDot';

const LOADING_SKELETON_ROWS = 6;

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { network, symbol } = useLocalSearchParams<{ network?: string; symbol?: string }>();
  const { transfers, isLoading, isError, syncStatus, syncError, myAddresses } =
    useFilteredTransactionHistory({ network, symbol });
  const [selected, setSelected] = useState<TokenTransfer | null>(null);

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
        <Text style={styles.errorText}>
          {syncError ?? 'Could not load transaction history'}
        </Text>
      </View>
    );
  } else {
    content = (
      <FlatList
        contentContainerStyle={styles.container}
        data={transfers ?? []}
        keyExtractor={(item, index) => `${item.transactionHash}-${index}`}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={40} color={colors.textSubtle} />
            <Text style={styles.statusText}>No transactions yet</Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push('/(wallet)/receive')}
            >
              <Text style={styles.emptyCtaText}>Receive funds</Text>
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
              <View>
                <Text style={styles.direction}>{received ? 'Received' : 'Sent'}</Text>
                <View style={styles.metaRow}>
                  <NetworkDot network={item.blockchain} size={6} />
                  <Text style={styles.meta}>
                    {item.blockchain} · {item.token?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.hash}>{truncateHash(item.transactionHash)}</Text>
                <Text style={styles.date}>{formatTransferDate(item.ts)}</Text>
              </View>
              <Text style={[styles.amount, received ? styles.amountIn : styles.amountOut]}>
                {received ? '+' : '-'}
                {amount}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title={symbol ? `History · ${symbol}` : 'History'} />
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
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  skeletonList: { paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  direction: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { fontSize: 12, color: colors.textMuted },
  hash: { fontSize: 12, color: colors.primary, marginTop: 4 },
  date: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '600' },
  amountIn: { color: colors.success },
  amountOut: { color: colors.danger },
  statusText: { color: colors.textMuted, marginTop: 12 },
  errorText: { color: colors.danger, textAlign: 'center' },
  emptyCta: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  emptyCtaText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
