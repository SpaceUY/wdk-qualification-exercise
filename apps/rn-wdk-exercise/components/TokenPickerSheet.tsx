import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import { TokenLogo } from '@/components/TokenLogo';
import { BottomSheet } from '@/components/BottomSheet';
import { isMainnetNetwork } from '@/config/networkMeta';
import type { AssetBalanceResult } from '@/hooks/useAssetBalances';
import { formatBalanceFromRaw, trimDisplayDecimals } from '@/utils/balance';

type TokenPickerSheetProps = {
  visible: boolean;
  assets: AssetConfig[];
  selectedId: string;
  // Display-ready balances keyed by asset id (from useAssetBalances). Optional so
  // callers without balance data still render a valid picker (amounts show '—').
  balanceByAssetId?: Map<string, AssetBalanceResult>;
  onSelect: (asset: AssetConfig) => void;
  onClose: () => void;
};

// Mirrors buildAssetRows: raw→human via decimals, then trim to 6 for display; '—'
// when the balance is unknown (missing or failed fetch) rather than a misleading 0.
function formatAssetBalance(asset: AssetConfig, result: AssetBalanceResult | undefined): string {
  const raw = result?.success ? result.balance : null;
  if (raw == null) return '—';
  const human = formatBalanceFromRaw(raw, asset.decimals) ?? '0';
  return trimDisplayDecimals(human, 6);
}

export function TokenPickerSheet({ visible, assets, selectedId, balanceByAssetId, onSelect, onClose }: TokenPickerSheetProps) {
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
          const isMainnet = isMainnetNetwork(item.network);
          const balance = formatAssetBalance(item, balanceByAssetId?.get(item.id));
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
                  <View style={styles.symbolRow}>
                    <AppText variant="body" style={styles.rowSymbol}>{item.symbol}</AppText>
                    <View style={[styles.chip, isMainnet ? styles.chipMainnet : styles.chipTestnet]}>
                      <AppText
                        variant="caption"
                        color={isMainnet ? 'successText' : 'warningText'}
                        style={styles.chipText}
                      >
                        {isMainnet ? 'Mainnet' : 'Testnet'}
                      </AppText>
                    </View>
                  </View>
                  <AppText variant="caption" color="textMuted">{item.network}</AppText>
                </View>
              </View>
              <AppText variant="body" style={styles.rowBalance}>{balance}</AppText>
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
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowSymbol: { fontWeight: '600' },
  chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  chipMainnet: { backgroundColor: colors.successBg },
  chipTestnet: { backgroundColor: colors.warningBg },
  chipText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
  rowBalance: { fontWeight: '600' },
});
