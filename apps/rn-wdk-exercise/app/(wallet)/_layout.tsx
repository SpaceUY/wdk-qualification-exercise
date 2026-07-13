import { Tabs } from 'expo-router';
import { GlassTabBar, type GlassTabBarProps } from '@/components/navigation/GlassTabBar';

// index (Home) and history are the visible tabs. The remaining wallet routes are
// full-screen flows pushed from the dashboard — href:null keeps them out of the
// tab bar, and GlassTabBar hides itself entirely while one of them is focused.
export default function WalletLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...(props as unknown as GlassTabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="send" options={{ href: null }} />
      <Tabs.Screen name="receive" options={{ href: null }} />
      <Tabs.Screen name="wallet-setup" options={{ href: null }} />
      <Tabs.Screen name="cashback" options={{ href: null }} />
    </Tabs>
  );
}
