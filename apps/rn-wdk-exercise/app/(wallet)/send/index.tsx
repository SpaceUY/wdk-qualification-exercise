import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scannedAddress?: string; scannedAmount?: string }>();
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig>(ALL_ASSET_CONFIGS[0]);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (params.scannedAddress) {
      setRecipient(params.scannedAddress);
    }
    if (params.scannedAmount) {
      setAmount(params.scannedAmount);
    }
  }, [params.scannedAddress, params.scannedAmount]);
  const [error, setError] = useState<string | null>(null);

  function validate(): boolean {
    if (!recipient.trim()) {
      setError('Recipient address is required');
      return false;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Enter a valid amount');
      return false;
    }
    setError(null);
    return true;
  }

  function handleContinue() {
    if (!validate()) return;
    router.push({
      pathname: '/(wallet)/send/confirm',
      params: {
        assetId: selectedAsset.id,
        network: selectedAsset.network,
        recipient: recipient.trim(),
        amount: amount.trim(),
        decimals: String(selectedAsset.decimals),
        symbol: selectedAsset.symbol,
      },
    });
  }

  function handleScan() {
    router.push({
      pathname: '/(wallet)/send/scan',
      params: { returnTo: 'send' },
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Send" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Token</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tokenScroll}>
          {ALL_ASSET_CONFIGS.map((asset) => (
            <TouchableOpacity
              key={asset.id}
              style={[styles.tokenChip, selectedAsset.id === asset.id && styles.tokenChipActive]}
              onPress={() => setSelectedAsset(asset)}
            >
              <Text style={[styles.tokenChipText, selectedAsset.id === asset.id && styles.tokenChipTextActive]}>
                {asset.symbol}
              </Text>
              <Text style={[styles.tokenNetwork, selectedAsset.id === asset.id && { color: '#93c5fd' }]}>
                {asset.network}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Recipient</Text>
        <View style={styles.recipientRow}>
          <TextInput
            style={[styles.input, styles.recipientInput]}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Address or scan QR"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
            <Text style={styles.scanButtonText}>QR</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder={`0.00 ${selectedAsset.symbol}`}
          keyboardType="decimal-pad"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Review Transaction</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8, marginTop: 16 },
  tokenScroll: { marginBottom: 4 },
  tokenChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    marginRight: 8,
    alignItems: 'center',
  },
  tokenChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tokenChipText: { fontSize: 14, fontWeight: '600', color: '#111' },
  tokenChipTextActive: { color: '#fff' },
  tokenNetwork: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  recipientRow: { flexDirection: 'row', gap: 8 },
  recipientInput: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  scanButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  scanButtonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#ef4444', marginTop: 12 },
  continueButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  continueButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
