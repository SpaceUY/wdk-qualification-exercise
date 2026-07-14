import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { trimDisplayDecimals } from '@/utils/balance';
import { formatTransferDate, isReceived, truncateHash } from '@/utils/transfers';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import { NetworkDot } from '@/components/NetworkDot';
import { TokenLogo } from '@/components/TokenLogo';

export type TransferRowVariant = 'detail' | 'history';

export type TransferRowProps = {
  transfer: TokenTransfer;
  myAddresses: string[];
  onPress: () => void;
  // 'detail' (default): stacked network/token/hash/date, used on the asset screen.
  // 'history': icon avatar + token badge + title, used on the history tab.
  variant?: TransferRowVariant;
};

export function TransferRow({ transfer, myAddresses, onPress, variant = 'detail' }: TransferRowProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const amount = trimDisplayDecimals(transfer.amount || '0', 6);
  const received = isReceived(transfer, myAddresses);
  const sign = received ? '+' : '-';
  const token = transfer.token?.toUpperCase() ?? '';

  if (variant === 'history') {
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
        <View style={styles.rowLeft}>
          <View style={styles.avatar}>
            <View style={styles.directionCircle}>
              {received ? (
                <ArrowDownLeft size={20} color={colors.success} strokeWidth={2.5} />
              ) : (
                <ArrowUpRight size={20} color={colors.danger} strokeWidth={2.5} />
              )}
            </View>
            <View style={styles.tokenBadge}>
              <TokenLogo symbol={token} size={18} />
            </View>
          </View>
          <View style={styles.info}>
            <AppText style={styles.itemTitle}>
              {received ? 'Receive' : 'Send'} {token} on {transfer.blockchain}
            </AppText>
            <AppText variant="caption" color="textSubtle" style={styles.date}>
              {formatTransferDate(transfer.ts)}
            </AppText>
          </View>
        </View>
        <AppText variant="mono" color={received ? 'success' : 'textPrimary'}>
          {sign}{amount}
        </AppText>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View>
        <AppText style={styles.direction}>{received ? 'Received' : 'Sent'}</AppText>
        <View style={styles.metaRow}>
          <NetworkDot network={transfer.blockchain} size={6} />
          <AppText variant="caption" color="textMuted">
            {transfer.blockchain} · {token}
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
        {sign}{amount}
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
  // detail variant
  direction: { fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  hash: { marginTop: spacing.xs },
  date: { marginTop: 2 },
  // history variant
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatar: { width: 40, height: 40 },
  directionCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center',
  },
  tokenBadge: {
    position: 'absolute', right: -3, bottom: -3, borderRadius: 12,
    borderWidth: 2, borderColor: colors.surface,
  },
  info: { flex: 1 },
  itemTitle: { fontWeight: '600' },
});
