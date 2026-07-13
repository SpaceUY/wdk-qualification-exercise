import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WdkAppProvider } from '@tetherto/wdk-react-native-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner-native';
import { wdkConfigs } from '@/config/networks';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/theme/colors';
import { AppLockOverlay } from '@/components/AppLockOverlay';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const wdkBundle = require('../.wdk-bundle/wdk-worklet.bundle.js');
const queryClient = new QueryClient();

export default function RootLayout() {
  const userId = useAuthStore((s) => s.userId);
  const colors = useThemeColors();

  return (
    // sonner-native's toast supports swipe-to-dismiss via react-native-gesture-handler,
    // which requires the whole tree to be wrapped in GestureHandlerRootView - without it,
    // showing any toast throws "GestureDetector must be used as a descendant of
    // GestureHandlerRootView".
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <WdkAppProvider
          wdkConfigs={wdkConfigs}
          bundle={{ bundle: wdkBundle as string }}
          currentUserId={userId}
          enableAutoInitialization={false}
        >
          {/* The app is dark-only, so the status bar text is always light;
              contentStyle keeps navigation transitions from flashing white. */}
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <AppLockOverlay />
          <Toaster />
        </WdkAppProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
