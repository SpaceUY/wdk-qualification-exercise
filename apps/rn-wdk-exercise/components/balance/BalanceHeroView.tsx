import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { gradients } from '@/theme/gradients';
import { radius, spacing } from '@/theme/tokens';
import { AmountText, AppText, Skeleton } from '@/components/ui';

export type BalanceHeroViewProps = {
  // Display-ready total ('$1,234.56'), or null while unknowable (prices missing).
  totalFiat: string | null;
  isLoading: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
};

// The dashboard's headline: total balance in fiat, big and white, on the elevated
// logo-navy surface with the app's one permitted gold veil behind it.
export function BalanceHeroView({ totalFiat, isLoading, hidden, onToggleHidden }: BalanceHeroViewProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <View style={styles.labelRow}>
        <AppText variant="caption" color="textMuted">
          Total balance
        </AppText>
        <Pressable
          testID="balance-visibility-toggle"
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'}
          hitSlop={8}
          onPress={onToggleHidden}
        >
          <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      {isLoading && totalFiat == null ? (
        <Skeleton testID="balance-hero-skeleton" width={160} height={40} borderRadius={radius.sm} />
      ) : (
        <AmountText variant="display" value={totalFiat ?? '—'} hidden={hidden} />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      marginHorizontal: spacing.lg,
      padding: spacing.xl,
      gap: spacing.md,
      // Clips the gradient veil to the rounded corners.
      overflow: 'hidden',
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  });
