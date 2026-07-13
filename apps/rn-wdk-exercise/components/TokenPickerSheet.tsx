import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import { TokenLogo } from '@/components/TokenLogo';
import { BottomSheet } from '@/components/BottomSheet';

type TokenPickerSheetProps = {
  visible: boolean;
  assets: AssetConfig[];
  selectedId: string;
  onSelect: (asset: AssetConfig) => void;
  onClose: () => void;
};

export function TokenPickerSheet({ visible, assets, selectedId, onSelect, onClose }: TokenPickerSheetProps) {
  const colors = useThemeColors();
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
          return (
            <TouchableOpacity
              key={item.id}
              testID={`token-picker-row-${item.id}`}
              style={styles.row}
              onPress={() => handleSelect(item)}
            >
              <View style={styles.rowIdentity}>
                <TokenLogo symbol={item.symbol} size={36} />
                <View>
                  <AppText variant="body" style={styles.rowSymbol}>{item.symbol}</AppText>
                  <AppText variant="caption" color="textMuted">{item.network}</AppText>
                </View>
              </View>
              {isSelected ? <Check size={20} color={colors.primary} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const createStyles = (_colors: ThemeColors) => StyleSheet.create({
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
  },
  rowIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowSymbol: { fontWeight: '600' },
});
