import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWallet } from '@tetherto/wdk-react-native-core';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import { humanAmountToRaw } from '@/utils/balance';
import { useBiometrics } from '@/hooks/useBiometrics';

export default function ConfirmSendScreen() {
  const router = useRouter();
  const { authenticate } = useBiometrics();
  const params = useLocalSearchParams<{
    assetId: string;
    network: string;
    recipient: string;
    amount: string;
    decimals: string;
    symbol: string;
  }>();

  const [sending, setSending] = useState(false);

  const assetConfig = ALL_ASSET_CONFIGS.find((a) => a.id === params.assetId);
  const { callAccountMethod } = useWallet();

  async function handleConfirm() {
    if (!assetConfig || !params.recipient || !params.amount) return;

    const granted = await authenticate('Approve transaction');
    if (!granted) {
      Alert.alert('Authentication required', 'Transaction was cancelled.');
      return;
    }

    setSending(true);
    try {
      const amountRaw = humanAmountToRaw(params.amount, assetConfig.decimals);
      const network = params.network ?? 'ethereum';

      if (assetConfig.isNative) {
        // Native assets (ETH, BTC, sBTC): raw send
        await callAccountMethod(network, 0, 'sendTransaction', { to: params.recipient, value: amountRaw });
      } else {
        // ERC-20 / Spark tokens: token transfer
        await callAccountMethod(network, 0, 'transfer', {
          token: assetConfig.address,
          recipient: params.recipient,
          amount: amountRaw,
        });
      }

      Alert.alert('Success', 'Transaction sent successfully!', [
        { text: 'OK', onPress: () => router.replace('/(wallet)') },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      Alert.alert('Error', message);
    } finally {
      setSending(false);
    }
  }

  if (!assetConfig) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Text>Asset not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>Confirm Transaction</Text>

      <View style={styles.detailCard}>
        <Row label="Token" value={`${params.symbol} (${assetConfig.network})`} />
        <Row label="Amount" value={`${params.amount} ${params.symbol}`} />
        <Row label="To" value={params.recipient ?? ''} mono />
      </View>

      <Text style={styles.biometricHint}>
        You will be asked to authenticate before sending.
      </Text>

      {sending ? (
        <ActivityIndicator size="large" style={{ marginTop: 32 }} />
      ) : (
        <>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm & Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 20,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14, color: '#6b7280', flex: 0, minWidth: 60 },
  rowValue: { fontSize: 14, fontWeight: '500', color: '#111', flex: 1, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  biometricHint: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginBottom: 32 },
  confirmButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#6b7280', fontSize: 16 },
});
