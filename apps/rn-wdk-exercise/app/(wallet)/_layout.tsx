import { Stack } from 'expo-router';
import { useThemeColors } from '@/theme/colors';

// (tabs) holds Home/History behind the GlassTabBar. Every other wallet route
// is a Stack screen here instead of a hidden Tabs.Screen, so navigating to it
// (router.push) plays a real native push transition — a bottom-tabs navigator
// only ever swaps instantly between tabs, hidden or not.
export default function WalletLayout() {
  const colors = useThemeColors();

  return (
    // contentStyle: without it, this Stack's own screen container defaults to
    // white, which flashes visibly during the push/pop slide animation.
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="send" />
      <Stack.Screen name="receive" />
      <Stack.Screen name="wallet-setup" />
      <Stack.Screen name="cashback" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
