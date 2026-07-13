import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

// Neutral coverage-limitation notice (this feature isn't fully rolled out yet), as opposed to
// NetworkFundsBanner's warning styling (real funds are at risk right now).
export function ComingSoonBanner({
  message,
  style,
}: {
  message: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.banner, style]} testID="coming-soon-banner">
      <AppText variant="caption" color="textMuted" style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  text: {},
});
