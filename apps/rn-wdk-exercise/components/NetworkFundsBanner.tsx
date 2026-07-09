import { StyleSheet, Text, View } from 'react-native';
import { isMainnetNetwork } from '@/config/networkMeta';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';

export function NetworkFundsBanner({ network }: { network: string }) {
  const styles = useThemedStyles(createStyles);
  if (!isMainnetNetwork(network)) return null;

  return (
    <View style={styles.banner} testID="mainnet-funds-banner">
      <Text style={styles.text}>⚠️ This network uses real funds — transactions are irreversible.</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  text: { color: colors.warningText, fontSize: 13, fontWeight: '600' },
});
