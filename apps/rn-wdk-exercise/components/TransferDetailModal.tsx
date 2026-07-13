import { useEffect, useState } from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { trimDisplayDecimals } from '@/utils/balance';
import { getExplorerTxUrl } from '@/utils/explorer';
import { formatTransferDate, isReceived } from '@/utils/transfers';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';

export function TransferDetailModal({
  transfer,
  myAddresses,
  onClose,
}: {
  transfer: TokenTransfer | null;
  myAddresses: string[];
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  // Closing sets `transfer` to null immediately, but the sheet needs a frame or two
  // to slide out. Keep rendering the last transfer so the content stays visible
  // through the close animation instead of vanishing under the handle.
  const [displayed, setDisplayed] = useState(transfer);
  useEffect(() => {
    if (transfer) setDisplayed(transfer);
  }, [transfer]);

  const explorerUrl = displayed
    ? getExplorerTxUrl(displayed.blockchain, displayed.transactionHash)
    : null;

  return (
    <BottomSheet visible={transfer != null} onClose={onClose}>
      <View style={styles.detailCard}>
        {displayed ? (
          <>
            <AppText variant="subtitle">
              {isReceived(displayed, myAddresses) ? 'Received' : 'Sent'}{' '}
              {displayed.token?.toUpperCase()}
            </AppText>
            <AppText variant="caption" color="textMuted" style={styles.detailSubtitle}>
              {displayed.blockchain} · {formatTransferDate(displayed.ts)}
            </AppText>

            <DetailRow
              label="Amount"
              value={`${trimDisplayDecimals(displayed.amount || '0', 6)} ${displayed.token?.toUpperCase() ?? ''}`}
            />
            <DetailRow label="Transaction Hash" value={displayed.transactionHash} copyable />
            <DetailRow label="From" value={displayed.from} copyable />
            <DetailRow label="To" value={displayed.to} copyable />

            {explorerUrl ? (
              <Button
                title="View on Explorer"
                onPress={() => Linking.openURL(explorerUrl)}
                style={styles.explorerButton}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

function DetailRow({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [copied, setCopied] = useState(false);

  // Flash the check icon for a second after copying, then revert to the copy icon.
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1000);
    return () => clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
  }

  return (
    <View style={styles.detailRow}>
      <AppText variant="caption" color="textSubtle" style={styles.detailLabel}>{label}</AppText>
      <View style={styles.detailValueRow}>
        <AppText style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
          {value}
        </AppText>
        {copyable ? (
          <TouchableOpacity
            onPress={handleCopy}
            hitSlop={8}
            style={styles.copyButton}
            accessibilityLabel={copied ? `${label} copied` : `Copy ${label}`}
          >
            {copied ? (
              <Check size={18} color={colors.primary} />
            ) : (
              <Copy size={18} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (_colors: ThemeColors) => StyleSheet.create({
  detailCard: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 36,
  },
  detailSubtitle: { marginTop: 4, marginBottom: spacing.lg },
  detailRow: { marginBottom: 14 },
  detailLabel: { marginBottom: 4 },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailValue: { flex: 1 },
  copyButton: { padding: 2 },
  explorerButton: { marginTop: spacing.md },
});
