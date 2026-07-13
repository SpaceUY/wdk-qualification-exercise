import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { gradients } from '@/theme/gradients';
import { OnboardingCarousel, ONBOARDING_SLIDES } from '@/components/onboarding';

export default function OnboardingScreen() {
  const router = useRouter();
  const setOnboardingSeen = useSettingsStore((s) => s.setOnboardingSeen);
  const styles = useThemedStyles(createStyles);

  const handleDone = () => {
    setOnboardingSeen();
    router.replace('/(auth)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.midnight} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <OnboardingCarousel slides={ONBOARDING_SLIDES} onDone={handleDone} />
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
  });
