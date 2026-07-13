import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Tag } from 'lucide-react-native';
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
  onSendPress: () => void;
  onReceivePress: () => void;
  onCashbackPress: () => void;
};

// The dashboard's headline: total balance in fiat, big and white, on the elevated
// logo-navy surface with the app's one permitted gold veil behind it. The
// send/receive/cashback shortcuts live here too, below the amount, so the
// card doubles as the wallet's primary action surface.
export function BalanceHeroView({
  totalFiat,
  isLoading,
  hidden,
  onToggleHidden,
  onSendPress,
  onReceivePress,
  onCashbackPress,
}: BalanceHeroViewProps) {
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
          {hidden ? (
            <EyeOff size={20} color={colors.textMuted} />
          ) : (
            <Eye size={20} color={colors.textMuted} />
          )}
        </Pressable>
      </View>
      {isLoading && totalFiat == null ? (
        <Skeleton testID="balance-hero-skeleton" width={160} height={40} borderRadius={radius.sm} />
      ) : (
        <AmountText variant="display" value={totalFiat ?? '—'} hidden={hidden} />
      )}

      <View style={styles.actionsRow}>
        <Pressable testID="balance-send" style={styles.actionButton} onPress={onSendPress}>
          <ArrowUpRight size={18} color={colors.textPrimary} />
          <AppText variant="caption" style={styles.actionLabel}>Send</AppText>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable testID="balance-receive" style={styles.actionButton} onPress={onReceivePress}>
          <ArrowDownLeft size={18} color={colors.textPrimary} />
          <AppText variant="caption" style={styles.actionLabel}>Receive</AppText>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable testID="balance-cashback" style={styles.actionButton} onPress={onCashbackPress}>
          <Tag size={18} color={colors.textPrimary} />
          <AppText variant="caption" style={styles.actionLabel}>Cashback</AppText>
        </Pressable>
      </View>
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
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
    },
    actionLabel: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
  });
