import { Linking, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { trimDisplayDecimals } from '@/utils/balance';
import { getExplorerTxUrl } from '@/utils/explorer';
import { formatTransferDate, isReceived } from '@/utils/transfers';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

async function copyToClipboard(label: string, value: string) {
  await Clipboard.setStringAsync(value);
  toast.success('Copied', { description: `${label} copied to clipboard.` });
}

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
  const explorerUrl = transfer
    ? getExplorerTxUrl(transfer.blockchain, transfer.transactionHash)
    : null;

  return (
    <Modal visible={transfer != null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Tapping the dimmed area behind the sheet dismisses it, like a native sheet. */}
        <TouchableOpacity style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.detailCard}>
          <View style={styles.grabHandle} />
          {transfer ? (
            <>
              <AppText variant="subtitle">
                {isReceived(transfer, myAddresses) ? 'Received' : 'Sent'}{' '}
                {transfer.token?.toUpperCase()}
              </AppText>
              <AppText variant="caption" color="textMuted" style={styles.detailSubtitle}>
                {transfer.blockchain} · {formatTransferDate(transfer.ts)}
              </AppText>

              <DetailRow
                label="Amount"
                value={`${trimDisplayDecimals(transfer.amount || '0', 6)} ${transfer.token?.toUpperCase() ?? ''}`}
              />
              <DetailRow
                label="Transaction Hash"
                value={transfer.transactionHash}
                onCopy={() => copyToClipboard('Transaction hash', transfer.transactionHash)}
              />
              <DetailRow
                label="From"
                value={transfer.from}
                onCopy={() => copyToClipboard('Address', transfer.from)}
              />
              <DetailRow
                label="To"
                value={transfer.to}
                onCopy={() => copyToClipboard('Address', transfer.to)}
              />

              {explorerUrl ? (
                <TouchableOpacity
                  style={styles.explorerButton}
                  onPress={() => Linking.openURL(explorerUrl)}
                >
                  <AppText variant="subtitle" color="primary" style={styles.explorerButtonText}>View on Explorer</AppText>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <AppText color="textMuted">Close</AppText>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailRow}>
      <AppText variant="caption" color="textSubtle" style={styles.detailLabel}>{label}</AppText>
      <View style={styles.detailValueRow}>
        <AppText style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
          {value}
        </AppText>
        {onCopy ? (
          <TouchableOpacity onPress={onCopy} hitSlop={8}>
            <AppText variant="caption" color="primary" style={styles.detailCopy}>Copy</AppText>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // Bottom sheet: the card is anchored to the bottom edge so the slide-in animation
  // ends where it points, instead of a centered card that stops mid-screen.
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  backdrop: { flex: 1 },
  detailCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: 36,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  detailSubtitle: { marginTop: 4, marginBottom: spacing.lg },
  detailRow: { marginBottom: 14 },
  detailLabel: { marginBottom: 4 },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailValue: { flex: 1 },
  detailCopy: { fontWeight: '600' },
  explorerButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  explorerButtonText: { fontSize: 15 },
  closeButton: { padding: 14, alignItems: 'center', marginTop: 4 },
});
