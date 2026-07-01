import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useAuthStore } from '@/stores/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function WalletLayout() {
  const router = useRouter();
  const { authenticate } = useBiometrics();
  const clearUserId = useAuthStore((s) => s.clear);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    authenticate('Unlock your wallet').then((granted) => {
      setChecking(false);
      if (!granted) {
        clearUserId();
        router.replace('/(auth)');
      }
    });
    // authenticate is stable, only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: true }} />;
}
