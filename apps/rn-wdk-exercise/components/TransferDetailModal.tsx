import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
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
  const sheetRef = useRef<BottomSheetModal>(null);
  const isOpen = transfer != null;
  const explorerUrl = transfer
    ? getExplorerTxUrl(transfer.blockchain, transfer.transactionHash)
    : null;

  // The sheet API is imperative (present/dismiss) while the screens drive it with a
  // `transfer` prop, so this effect translates prop changes into sheet commands.
  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [isOpen]);

  // BottomSheetModal doesn't handle the Android hardware back button (the RN Modal it
  // replaced did via onRequestClose), so close on back press while the sheet is open.
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        // The theme overlay color already carries its alpha, so the backdrop fades
        // to it fully instead of layering the library's 0.5 default on top.
        opacity={1}
        style={[props.style, styles.backdrop]}
        pressBehavior="close"
      />
    ),
    [styles],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={onClose}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.detailCard}>
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
      </BottomSheetView>
    </BottomSheetModal>
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
  backdrop: { backgroundColor: colors.overlay },
  sheetBackground: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  detailCard: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 36,
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
