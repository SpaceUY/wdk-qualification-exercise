import '../global.css';
import { Stack } from 'expo-router';
import { WdkAppProvider } from '@tetherto/wdk-react-native-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner-native';
import { wdkConfigs } from '@/config/networks';
import { useAuthStore } from '@/stores/authStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const wdkBundle = require('../.wdk-bundle/wdk-worklet.bundle.js');
const queryClient = new QueryClient();

export default function RootLayout() {
  const userId = useAuthStore((s) => s.userId);

  return (
    <QueryClientProvider client={queryClient}>
      <WdkAppProvider
        wdkConfigs={wdkConfigs}
        bundle={{ bundle: wdkBundle as string }}
        currentUserId={userId}
        enableAutoInitialization={false}
      >
        <Stack screenOptions={{ headerShown: false }} />
        <Toaster />
      </WdkAppProvider>
    </QueryClientProvider>
  );
}
