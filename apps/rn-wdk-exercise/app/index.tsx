import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function RootIndex() {
  const userId = useAuthStore((s) => s.userId);
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  if (!hasSeenOnboarding) return <Redirect href="/(onboarding)" />;
  return userId ? <Redirect href="/(wallet)" /> : <Redirect href="/(auth)" />;
}
