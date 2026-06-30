import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const userId = useAuthStore((s) => s.userId);
  if (userId) return <Redirect href="/(wallet)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
