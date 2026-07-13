import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AmountText, AppText } from '@/components/ui';
import { NetworkDot } from '@/components/NetworkDot';
import type { AssetRowData } from './buildAssetRows';

export type AssetRowProps = {
  asset: AssetRowData;
  hidden: boolean;
  onPress: () => void;
};

// One asset in the dashboard list: identity on the left, value (crypto over fiat)
// on the right — the Trust Wallet hierarchy.
export function AssetRow({ asset, hidden, onPress }: AssetRowProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View>
        <View style={styles.symbolRow}>
          <NetworkDot network={asset.network} />
          <AppText variant="subtitle">{asset.symbol}</AppText>
          <View style={[styles.chip, asset.isMainnet ? styles.chipMainnet : styles.chipTestnet]}>
            <AppText
              variant="caption"
              color={asset.isMainnet ? 'successText' : 'warningText'}
              style={styles.chipText}
            >
              {asset.isMainnet ? 'Mainnet' : 'Testnet'}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" color="textMuted" style={styles.network}>
          {asset.network}
        </AppText>
      </View>
      <View style={styles.amounts}>
        <AmountText value={asset.cryptoAmount} hidden={hidden} />
        {asset.fiatAmount != null && (
          <AmountText variant="caption" color="textMuted" value={asset.fiatAmount} hidden={hidden} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing.lg,
      marginVertical: spacing.xs,
      padding: spacing.lg,
      borderRadius: radius.lg,
    },
    symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    network: { marginTop: 2 },
    chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    chipMainnet: { backgroundColor: colors.successBg },
    chipTestnet: { backgroundColor: colors.warningBg },
    chipText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
    amounts: { alignItems: 'flex-end', gap: 2 },
  });
