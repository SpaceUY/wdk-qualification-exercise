import { Redirect, Stack } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';

export default function OnboardingLayout() {
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  // Deep links can't land a returning user back in onboarding.
  if (hasSeenOnboarding) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
