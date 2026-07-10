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
import { toast } from 'sonner-native';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NetworkFundsBanner } from '@/components/NetworkFundsBanner';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';

export default function SendScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
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

  function validate(): boolean {
    if (!recipient.trim()) {
      toast.error('Recipient Required', {
        description: 'Enter a recipient address or scan a QR code.',
      });
      return false;
    }
    // iOS's decimal-pad keyboard shows a locale decimal separator (e.g. ',' on es-AR/es-ES
    // devices) instead of '.', so accept either — humanAmountToRaw() normalizes the same
    // way downstream. The strict shape check (digits with at most one separator) also
    // rejects pasted values like '1e3' or '0x10' that Number() would accept but
    // humanAmountToRaw() would silently mangle.
    const trimmedAmount = amount.trim();
    if (!/^\d*[.,]?\d+$/.test(trimmedAmount)) {
      toast.error('Invalid Amount', {
        description: 'Use digits with one decimal separator (e.g. 0.5).',
      });
      return false;
    }
    if (Number(trimmedAmount.replace(',', '.')) <= 0) {
      toast.error('Invalid Amount', {
        description: 'Amount must be greater than zero.',
      });
      return false;
    }
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
              <Text style={[styles.tokenNetwork, selectedAsset.id === asset.id && styles.tokenNetworkActive]}>
                {asset.network}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <NetworkFundsBanner network={selectedAsset.network} />

        <Text style={styles.label}>Recipient</Text>
        <View style={styles.recipientRow}>
          <TextInput
            style={[styles.input, styles.recipientInput]}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Address or scan QR"
            placeholderTextColor={colors.textSubtle}
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
          placeholderTextColor={colors.textSubtle}
          keyboardType="decimal-pad"
        />

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Review Transaction</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 24 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8, marginTop: 16 },
  tokenScroll: { marginBottom: 4 },
  tokenChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    marginRight: 8,
    alignItems: 'center',
  },
  tokenChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tokenChipText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  tokenChipTextActive: { color: colors.textOnPrimary },
  tokenNetwork: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
  tokenNetworkActive: { color: colors.textOnPrimary, opacity: 0.85 },
  recipientRow: { flexDirection: 'row', gap: 8 },
  recipientInput: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  scanButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  scanButtonText: { color: colors.textOnPrimary, fontWeight: '700' },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  continueButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
});
