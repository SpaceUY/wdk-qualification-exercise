import { Tabs } from 'expo-router';
import { GlassTabBar, type GlassTabBarProps } from '@/components/navigation/GlassTabBar';

// Home and History are the only two real tabs. Every other wallet route (send,
// receive, wallet-setup, cashback, settings) lives one level up as a Stack
// screen (see ../_layout.tsx) so navigating to it plays a real push transition
// instead of the instant swap a hidden Tabs.Screen would give.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...(props as unknown as GlassTabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}
