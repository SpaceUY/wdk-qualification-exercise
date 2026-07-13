import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { trimDisplayDecimals } from '@/utils/balance';
import { formatTransferDate, isReceived, truncateHash } from '@/utils/transfers';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import { NetworkDot } from '@/components/NetworkDot';

export type TransferRowProps = {
  transfer: TokenTransfer;
  myAddresses: string[];
  onPress: () => void;
};

// One transfer in a list: direction + network/token/hash/date on the left, signed
// amount on the right. Same layout as the History screen's rows.
export function TransferRow({ transfer, myAddresses, onPress }: TransferRowProps) {
  const styles = useThemedStyles(createStyles);
  const amount = trimDisplayDecimals(transfer.amount || '0', 6);
  const received = isReceived(transfer, myAddresses);

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View>
        <AppText style={styles.direction}>{received ? 'Received' : 'Sent'}</AppText>
        <View style={styles.metaRow}>
          <NetworkDot network={transfer.blockchain} size={6} />
          <AppText variant="caption" color="textMuted">
            {transfer.blockchain} · {transfer.token?.toUpperCase()}
          </AppText>
        </View>
        <AppText variant="caption" color="primary" style={styles.hash}>
          {truncateHash(transfer.transactionHash)}
        </AppText>
        <AppText variant="caption" color="textSubtle" style={styles.date}>
          {formatTransferDate(transfer.ts)}
        </AppText>
      </View>
      <AppText variant="mono" color={received ? 'success' : 'danger'}>
        {received ? '+' : '-'}
        {amount}
      </AppText>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  direction: { fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  hash: { marginTop: spacing.xs },
  date: { marginTop: 2 },
});
