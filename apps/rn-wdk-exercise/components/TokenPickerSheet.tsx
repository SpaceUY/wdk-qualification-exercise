import { FlatList, Modal, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import { TokenLogo } from '@/components/TokenLogo';

// Leaves this much clearance above the sheet even when the list is long enough
// to fill the whole screen, so it never runs into the status bar/notch.
const TOP_CLEARANCE = spacing.xxl;

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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxSheetHeight = windowHeight - insets.top - TOP_CLEARANCE;

  function handleSelect(asset: AssetConfig) {
    onSelect(asset);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Tapping the dimmed area behind the sheet dismisses it, like a native sheet. */}
        <TouchableOpacity style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { maxHeight: maxSheetHeight }]}>
          <View style={styles.grabHandle} />
          <AppText variant="subtitle" style={styles.title}>Select Token</AppText>
          <FlatList
            data={assets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <TouchableOpacity
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
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  backdrop: { flex: 1 },
  sheet: {
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
