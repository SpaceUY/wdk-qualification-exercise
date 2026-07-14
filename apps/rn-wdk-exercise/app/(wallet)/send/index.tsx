import { useEffect, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import { BookUser, ChevronDown, QrCode } from 'lucide-react-native';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import { useAssetBalances } from '@/hooks/useAssetBalances';
import { usePrices } from '@/hooks/usePrices';
import { useSettingsStore } from '@/stores/settingsStore';
import { Header, HeaderBackTitle } from '@/components/Header';
import { NetworkFundsBanner } from '@/components/NetworkFundsBanner';
import { TokenLogo } from '@/components/TokenLogo';
import { TokenPickerSheet } from '@/components/TokenPickerSheet';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AmountText, AppText, Button, Card, ScalePressable } from '@/components/ui';
import { isValidAddressForNetwork } from '@/utils/address';
import { formatBalanceFromRaw, trimDisplayDecimals } from '@/utils/balance';

const INPUT_HEIGHT = 50;

export default function SendScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ scannedAddress?: string; scannedAmount?: string }>();
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig>(ALL_ASSET_CONFIGS[0]);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const { balanceByAssetId } = useAssetBalances();
  const { data: pricesData } = usePrices();
  const isBalanceHidden = useSettingsStore((s) => s.isBalanceHidden);

  const selectedBalanceResult = balanceByAssetId.get(selectedAsset.id);
  const selectedRaw = selectedBalanceResult?.success ? selectedBalanceResult.balance : null;
  // Full-precision human amount: Max fills this (nothing silently shaved off),
  // while the label next to "Amount" shows the 6-decimal trimmed version.
  const selectedBalance =
    selectedRaw != null ? (formatBalanceFromRaw(selectedRaw, selectedAsset.decimals) ?? '0') : null;

  function handleMaxAmount() {
    if (selectedBalance == null) return;
    setAmount(selectedBalance);
  }

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
    if (!isValidAddressForNetwork(recipient, selectedAsset.network)) {
      toast.error('Invalid Address', {
        description: `That doesn't look like a valid ${selectedAsset.network} address.`,
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
        recipient: recipient.trim(),
        amount: amount.trim(),
      },
    });
  }

  function handleSelectAsset(asset: AssetConfig) {
    // An amount typed for one token means nothing in another (different value,
    // different decimals) — clear it on a real switch, keep it on a same-token tap.
    if (asset.id !== selectedAsset.id) {
      setAmount('');
    }
    setSelectedAsset(asset);
  }

  function handleScan() {
    router.push({
      pathname: '/(wallet)/send/scan',
      params: { returnTo: 'send' },
    });
  }

  function handleOpenAddressBook() {
    router.push({
      pathname: '/(wallet)/send/address-book',
      params: { network: selectedAsset.network },
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header left={<HeaderBackTitle title="Send" />} />
      <ScrollView contentContainerStyle={styles.container}>
        <Card elevated style={styles.formCard}>
          <AppText variant="caption" color="textMuted" style={styles.label}>Token</AppText>
          <ScalePressable
            activeScale={0.97}
            testID="token-picker-trigger"
            style={styles.tokenTrigger}
            onPress={() => setPickerVisible(true)}
          >
            <View style={styles.tokenTriggerIdentity}>
              <TokenLogo symbol={selectedAsset.symbol} size={32} />
              <View>
                <AppText variant="body" style={styles.tokenTriggerSymbol}>{selectedAsset.symbol}</AppText>
                <AppText variant="caption" color="textMuted">{selectedAsset.network}</AppText>
              </View>
            </View>
            <ChevronDown size={20} color={colors.textMuted} />
          </ScalePressable>

          <AppText variant="caption" color="textMuted" style={[styles.label, styles.sectionLabel]}>Recipient</AppText>
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
            <ScalePressable
              activeScale={0.88}
              style={styles.scanButton}
              onPress={handleScan}
              accessibilityLabel="Scan QR code"
            >
              <QrCode size={22} color={colors.textPrimary} />
            </ScalePressable>
            <ScalePressable
              activeScale={0.88}
              testID="send-open-address-book"
              style={styles.scanButton}
              onPress={handleOpenAddressBook}
              accessibilityLabel="Open address book"
            >
              <BookUser size={22} color={colors.textPrimary} />
            </ScalePressable>
          </View>

          <View style={styles.amountLabelRow}>
            <AppText variant="caption" color="textMuted" style={styles.amountLabel}>Amount</AppText>
            <ScalePressable
              activeScale={0.92}
              testID="send-max-balance"
              style={styles.balanceTap}
              onPress={handleMaxAmount}
              disabled={selectedBalance == null}
              accessibilityLabel="Use maximum balance"
            >
              <AppText variant="caption" color="textMuted">Balance:</AppText>
              <AmountText
                variant="caption"
                color="textMuted"
                value={selectedBalance != null ? trimDisplayDecimals(selectedBalance, 6) : '—'}
                hidden={isBalanceHidden}
              />
              {selectedBalance != null && (
                <AppText variant="caption" color="primary" style={styles.maxText}>Max</AppText>
              )}
            </ScalePressable>
          </View>
          {/* The selected token's logo + symbol live inside the field so a bare
              number never reads as ambiguous ("0.5 of what?"). */}
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textSubtle}
              keyboardType="decimal-pad"
            />
            <View style={styles.amountToken}>
              <TokenLogo symbol={selectedAsset.symbol} size={20} />
              <AppText variant="body" style={styles.amountSymbol}>{selectedAsset.symbol}</AppText>
            </View>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <NetworkFundsBanner network={selectedAsset.network} />
        <Button title="Review Transaction" onPress={handleContinue} />
      </View>

      <TokenPickerSheet
        visible={pickerVisible}
        assets={ALL_ASSET_CONFIGS}
        selectedId={selectedAsset.id}
        onSelect={handleSelectAsset}
        onClose={() => setPickerVisible(false)}
        balanceByAssetId={balanceByAssetId}
        balancesHidden={isBalanceHidden}
        prices={pricesData?.prices}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl },
  formCard: { marginBottom: spacing.lg },
  label: { fontWeight: '600', marginBottom: spacing.sm },
  sectionLabel: { marginTop: spacing.md },
  tokenTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  tokenTriggerIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tokenTriggerSymbol: { fontWeight: '600' },
  recipientRow: { flexDirection: 'row', gap: spacing.sm },
  recipientInput: { flex: 1, height: INPUT_HEIGHT },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  amountLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  amountLabel: { fontWeight: '600' },
  balanceTap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  maxText: { fontWeight: '700' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingRight: 14,
  },
  amountInput: { flex: 1, padding: 14, fontSize: 15, color: colors.textPrimary },
  amountToken: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountSymbol: { fontWeight: '600' },
  scanButton: {
    width: INPUT_HEIGHT,
    height: INPUT_HEIGHT,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
});
