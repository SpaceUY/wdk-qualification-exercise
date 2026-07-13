import { Stack } from 'expo-router';
import { useThemeColors } from '@/theme/colors';

export default function WalletSetupLayout() {
  const colors = useThemeColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
