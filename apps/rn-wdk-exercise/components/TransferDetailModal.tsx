import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { trimDisplayDecimals } from '@/utils/balance';
import { getExplorerTxUrl } from '@/utils/explorer';
import { formatTransferDate, isReceived } from '@/utils/transfers';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';

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
              <Text style={styles.detailTitle}>
                {isReceived(transfer, myAddresses) ? 'Received' : 'Sent'}{' '}
                {transfer.token?.toUpperCase()}
              </Text>
              <Text style={styles.detailSubtitle}>
                {transfer.blockchain} · {formatTransferDate(transfer.ts)}
              </Text>

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
                  <Text style={styles.explorerButtonText}>View on Explorer</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
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
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
          {value}
        </Text>
        {onCopy ? (
          <TouchableOpacity onPress={onCopy} hitSlop={8}>
            <Text style={styles.detailCopy}>Copy</Text>
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 16,
  },
  detailTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  detailSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 16 },
  detailRow: { marginBottom: 14 },
  detailLabel: { fontSize: 12, color: colors.textSubtle, marginBottom: 4 },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailValue: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  detailCopy: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  explorerButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  explorerButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  closeButton: { padding: 14, alignItems: 'center', marginTop: 4 },
  closeButtonText: { color: colors.textMuted, fontSize: 15 },
});
