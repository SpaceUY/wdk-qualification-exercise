import { Redirect, Stack } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import { useThemeColors } from '@/theme/colors';

export default function OnboardingLayout() {
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  const colors = useThemeColors();
  // Deep links can't land a returning user back in onboarding.
  if (hasSeenOnboarding) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
