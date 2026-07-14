import { StyleSheet, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { AppText } from './AppText';

export type NetworkBadgeProps = {
  isMainnet: boolean;
};

// The Mainnet/Testnet chip shown next to an asset's symbol — green for real-funds
// networks, amber for testnets. Shared by the dashboard asset list and the send
// flow's token picker so both always read the same.
export function NetworkBadge({ isMainnet }: NetworkBadgeProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.chip, isMainnet ? styles.chipMainnet : styles.chipTestnet]}>
      <AppText
        variant="caption"
        color={isMainnet ? 'successText' : 'warningText'}
        style={styles.chipText}
      >
        {isMainnet ? 'Mainnet' : 'Testnet'}
      </AppText>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    chipMainnet: { backgroundColor: colors.successBg },
    chipTestnet: { backgroundColor: colors.warningBg },
    chipText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
  });
