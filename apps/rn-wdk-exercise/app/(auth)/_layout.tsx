import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/theme/colors';

export default function AuthLayout() {
  const userId = useAuthStore((s) => s.userId);
  const colors = useThemeColors();
  if (userId) return <Redirect href="/(wallet)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
