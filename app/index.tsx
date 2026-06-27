import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function RootIndex() {
  const userId = useAuthStore((s) => s.userId);
  return userId ? <Redirect href="/(wallet)" /> : <Redirect href="/(auth)" />;
}
