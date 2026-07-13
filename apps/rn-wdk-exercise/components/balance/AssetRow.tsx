import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AmountText, AppText } from '@/components/ui';
import { TokenLogo } from '@/components/TokenLogo';
import type { AssetRowData } from './buildAssetRows';

const PRESS_SPRING = { damping: 18, stiffness: 260, mass: 0.6 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type AssetRowProps = {
  asset: AssetRowData;
  hidden: boolean;
  onPress: () => void;
};

// One asset in the dashboard list: identity on the left, value (crypto over fiat)
// on the right — the Trust Wallet hierarchy.
export function AssetRow({ asset, hidden, onPress }: AssetRowProps) {
  const styles = useThemedStyles(createStyles);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.row, animatedStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.97, PRESS_SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, PRESS_SPRING); }}
    >
      <View style={styles.identity}>
        <TokenLogo symbol={asset.symbol} size={36} />
        <View>
          <View style={styles.symbolRow}>
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
      </View>
      <View style={styles.amounts}>
        <AmountText value={asset.cryptoAmount} hidden={hidden} />
        {asset.fiatAmount != null && (
          <AmountText variant="caption" color="textMuted" value={asset.fiatAmount} hidden={hidden} />
        )}
      </View>
    </AnimatedPressable>
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
    chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    chipMainnet: { backgroundColor: colors.successBg },
    chipTestnet: { backgroundColor: colors.warningBg },
    chipText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
    amounts: { alignItems: 'flex-end', gap: 2 },
  });
