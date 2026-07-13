import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@tetherto/wdk-react-native-core';
import { ALL_ASSET_CONFIGS } from '@/config/assets';
import { humanAmountToRaw } from '@/utils/balance';
import { useBiometrics } from '@/hooks/useBiometrics';
import { getMerchants } from '@/utils/api';
import { DEFAULT_MERCHANT_NAME } from '@/utils/addressBook';
import { NetworkFundsBanner } from '@/components/NetworkFundsBanner';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button, Card, Divider } from '@/components/ui';

// The only entry in ALL_ASSET_CONFIGS with network: 'ethereum' and symbol: 'USDT' — the
// asset the indexer/transfer.processor.ts actually watches for cashback-eligible transfers.
const CASHBACK_ELIGIBLE_ASSET_ID = 'ethereum-usdt';

// Rules match against the raw ethers.js / provider error message. Ordered by how
// commonly they occur when sending a transaction; first match wins.
const SEND_ERROR_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /insufficient funds|code=INSUFFICIENT_FUNDS/i,
    message: "You don't have enough balance to cover this transaction and its network fee.",
  },
  {
    pattern: /invalid address|bad address checksum/i,
    message: 'The recipient address looks invalid. Please check it and try again.',
  },
  {
    pattern: /code=UNCONFIGURED_NAME|network does not support ens/i,
    message: "We couldn't resolve that recipient address. Please check it and try again.",
  },
  {
    pattern: /execution reverted|code=CALL_EXCEPTION/i,
    message: 'The network rejected this transaction. Double check the recipient and amount, then try again.',
  },
  {
    pattern: /code=NETWORK_ERROR|code=SERVER_ERROR|could not detect network/i,
    message: 'Network connection issue. Please check your connection and try again.',
  },
  {
    pattern: /code=TIMEOUT/i,
    message: 'The request timed out. Please try again.',
  },
  {
    pattern: /code=NONCE_EXPIRED|code=REPLACEMENT_UNDERPRICED|code=TRANSACTION_REPLACED/i,
    message: 'This transaction conflicts with another pending one. Please wait a moment and try again.',
  },
];

function getSendErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Transaction failed';
  const rule = SEND_ERROR_RULES.find(({ pattern }) => pattern.test(raw));
  return rule ? rule.message : raw;
}

export default function ConfirmSendScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
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
  const { data: merchants } = useQuery({ queryKey: ['merchants'], queryFn: getMerchants });

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
      Alert.alert('Error', getSendErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (!assetConfig) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <AppText>Asset not found</AppText>
      </SafeAreaView>
    );
  }

  const recipientLower = params.recipient?.toLowerCase() ?? '';
  const isMerchantAddress = merchants?.addresses.includes(recipientLower) ?? false;
  const isCashbackEligibleAsset = params.assetId === CASHBACK_ELIGIBLE_ASSET_ID;
  const showCashbackBadge = isMerchantAddress && isCashbackEligibleAsset;
  const merchantName = merchants?.names[recipientLower] ?? DEFAULT_MERCHANT_NAME;
  const normalizedAmount = params.amount ? Number(params.amount.replace(',', '.')) : 0;
  const estimatedCashback = merchants ? (normalizedAmount * merchants.cashbackRate).toFixed(4) : '0.0000';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <AppText variant="title" style={styles.title}>Confirm Transaction</AppText>

      {showCashbackBadge && (
        <View style={styles.merchantBadge} testID="merchant-cashback-badge">
          <AppText variant="body" color="successText" style={styles.merchantBadgeTitle}>✓ {merchantName}</AppText>
          <AppText variant="caption" color="successText" style={styles.merchantBadgeSubtitle}>
            You&apos;ll earn ~{estimatedCashback} UTL cashback
          </AppText>
        </View>
      )}

      <NetworkFundsBanner network={assetConfig.network} />

      <Card elevated style={styles.detailCard}>
        <Row label="Token" value={`${params.symbol} (${assetConfig.network})`} />
        <Divider />
        <Row label="Amount" value={`${params.amount} ${params.symbol}`} />
        <Divider />
        <Row label="To" value={params.recipient ?? ''} mono />
      </Card>

      <AppText variant="caption" color="textMuted" style={styles.biometricHint}>
        You will be asked to authenticate before sending.
      </AppText>

      {sending ? (
        <ActivityIndicator size="large" style={styles.sendingIndicator} />
      ) : (
        <>
          <Button title="Confirm & Send" onPress={handleConfirm} style={styles.confirmButton} />
          <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        </>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <AppText color="textMuted" style={styles.rowLabel}>{label}</AppText>
      <AppText variant={mono ? 'mono' : 'body'} style={[styles.rowValue, mono && styles.mono]} numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  title: { marginBottom: spacing.xl },
  merchantBadge: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 20,
  },
  merchantBadgeTitle: { fontWeight: '700' },
  merchantBadgeSubtitle: { marginTop: spacing.xs },
  detailCard: { marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { flex: 0, minWidth: 60 },
  rowValue: { fontWeight: '500', flex: 1, textAlign: 'right' },
  mono: { fontSize: 12, lineHeight: 18 },
  biometricHint: { textAlign: 'center', marginBottom: spacing.xxl },
  confirmButton: { marginBottom: spacing.md },
  sendingIndicator: { marginTop: spacing.xxl },
});
