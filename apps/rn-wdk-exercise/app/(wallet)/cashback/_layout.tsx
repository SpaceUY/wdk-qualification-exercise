import { Stack } from 'expo-router';
import { useThemeColors } from '@/theme/colors';

export default function CashbackLayout() {
  const colors = useThemeColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
