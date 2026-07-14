import { StyleSheet, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AmountText, AppText, NetworkBadge, ScalePressable } from '@/components/ui';
import { TokenLogo } from '@/components/TokenLogo';
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
    <ScalePressable
      activeScale={0.97}
      style={styles.row}
      onPress={onPress}
    >
      <View style={styles.identity}>
        <TokenLogo symbol={asset.symbol} size={36} />
        <View>
          <View style={styles.symbolRow}>
            <AppText variant="subtitle">{asset.symbol}</AppText>
            <NetworkBadge isMainnet={asset.isMainnet} />
          </View>
          <AppText variant="caption" color="textMuted" style={styles.network}>
            {asset.network}
          </AppText>
        </View>
      </View>
      <View style={styles.amounts}>
        <AmountText value={asset.cryptoAmount} hidden={hidden} />
        {asset.fiatAmount != null && (
          <AmountText variant="caption" color="textMuted" value={asset.fiatAmount} hidden={hidden} />
        )}
        {/* Fully omitted (not masked) in privacy mode: showing the day's direction
            would leak whether the hidden balance gained or lost value. */}
        {!hidden && asset.changePct24h != null && (
          <AppText
            variant="caption"
            color={asset.changePct24h.isPositive ? 'successText' : 'dangerText'}
            style={styles.changePct}
          >
            {asset.changePct24h.label}
          </AppText>
        )}
      </View>
    </ScalePressable>
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
    identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    network: { marginTop: 2 },
    changePct: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
    amounts: { alignItems: 'flex-end', gap: 2 },
  });
