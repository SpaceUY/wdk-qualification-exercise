import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import type { AssetBalanceResult } from '@/hooks/useAssetBalances';
import { isMainnetNetwork } from '@/config/networkMeta';
import { computeFiatValue, formatBalanceFromRaw, formatFiat, trimDisplayDecimals } from '@/utils/balance';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AmountText, AppText, NetworkBadge } from '@/components/ui';
import { TokenLogo } from '@/components/TokenLogo';
import { BottomSheet } from '@/components/BottomSheet';

type TokenPickerSheetProps = {
  visible: boolean;
  assets: AssetConfig[];
  selectedId: string;
  onSelect: (asset: AssetConfig) => void;
  onClose: () => void;
  // Raw balance results keyed by asset id (from useAssetBalances). Optional so
  // callers without balance data still render a valid picker (amounts show '—').
  balanceByAssetId?: Map<string, AssetBalanceResult>;
  balancesHidden?: boolean;
  prices?: Record<string, number | null>;
};

// Same raw→display pipeline as the dashboard's buildAssetRows: '—' when the
// balance is unknown (failed/missing fetch), never a fake 0; fiat computed from
// the full-precision amount and null (rendered as nothing) when unknowable.
function formatRowBalance(
  result: AssetBalanceResult | undefined,
  decimals: number,
  price: number | null | undefined,
): { cryptoAmount: string; fiatAmount: string | null } {
  const raw = result?.success ? result.balance : null;
  const human = raw != null ? (formatBalanceFromRaw(raw, decimals) ?? '0') : null;
  return {
    cryptoAmount: human != null ? trimDisplayDecimals(human, 6) : '—',
    fiatAmount: formatFiat(computeFiatValue(human, price)),
  };
}

export function TokenPickerSheet({
  visible,
  assets,
  selectedId,
  onSelect,
  onClose,
  balanceByAssetId,
  balancesHidden = false,
  prices,
}: TokenPickerSheetProps) {
  const styles = useThemedStyles(createStyles);

  function handleSelect(asset: AssetConfig) {
    onSelect(asset);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <AppText variant="subtitle" style={styles.title}>Select Token</AppText>
        {assets.map((item) => {
          const isSelected = item.id === selectedId;
          const { cryptoAmount, fiatAmount } = formatRowBalance(
            balanceByAssetId?.get(item.id),
            item.decimals,
            prices?.[item.symbol],
          );
          return (
            <TouchableOpacity
              key={item.id}
              testID={`token-picker-row-${item.id}`}
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => handleSelect(item)}
            >
              <View style={styles.rowIdentity}>
                <TokenLogo symbol={item.symbol} size={36} />
                <View>
                  <View style={styles.rowSymbolRow}>
                    <AppText variant="body" style={styles.rowSymbol}>{item.symbol}</AppText>
                    <NetworkBadge isMainnet={isMainnetNetwork(item.network)} />
                  </View>
                  <AppText variant="caption" color="textMuted">{item.network}</AppText>
                </View>
              </View>
              <View style={styles.amounts}>
                <AmountText value={cryptoAmount} hidden={balancesHidden} />
                {fiatAmount != null && (
                  <AmountText variant="caption" color="textMuted" value={fiatAmount} hidden={balancesHidden} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 36,
  },
  title: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    // Negative margin widens the highlight beyond the content inset; the matching
    // padding keeps the row's text aligned with the rest of the sheet.
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md + spacing.sm,
    borderRadius: radius.md,
  },
  // Selected token: darker gray fill across the whole row (replaces the check tick).
  rowSelected: { backgroundColor: colors.surfaceMuted },
  rowIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowSymbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowSymbol: { fontWeight: '600' },
  amounts: { alignItems: 'flex-end', gap: 2 },
});
