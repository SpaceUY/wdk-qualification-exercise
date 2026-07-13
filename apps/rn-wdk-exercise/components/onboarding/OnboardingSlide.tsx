import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';
import type { OnboardingSlideData } from './slides';

// One onboarding page: gold-tinted icon medallion over title and supporting copy.
export function OnboardingSlide({ slide }: { slide: OnboardingSlideData }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={slide.icon} size={44} color={colors.primary} />
      </View>
      <AppText variant="title" style={styles.title}>
        {slide.title}
      </AppText>
      <AppText color="textMuted" style={styles.subtitle}>
        {slide.subtitle}
      </AppText>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
      gap: spacing.lg,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: radius.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    title: { textAlign: 'center' },
    subtitle: { textAlign: 'center' },
  });
