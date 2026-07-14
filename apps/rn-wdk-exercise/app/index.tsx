import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function RootIndex() {
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const userId = useAuthStore((s) => s.userId);
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  // Auth persistence is now async (SecureStore); render nothing until it has been
  // read back, otherwise the first frame sees userId=null and flashes the login
  // screen for an already-signed-in user.
  if (!hasHydrated) return null;
  if (!hasSeenOnboarding) return <Redirect href="/(onboarding)" />;
  return userId ? <Redirect href="/(wallet)" /> : <Redirect href="/(auth)" />;
}
