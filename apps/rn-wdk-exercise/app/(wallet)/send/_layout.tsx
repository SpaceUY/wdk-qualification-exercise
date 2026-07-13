import { Stack } from 'expo-router';
import { useThemeColors } from '@/theme/colors';

export default function SendLayout() {
  const colors = useThemeColors();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
