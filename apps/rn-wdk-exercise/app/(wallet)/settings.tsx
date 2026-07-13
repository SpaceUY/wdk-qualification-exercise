import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { KeyRound, LogOut } from 'lucide-react-native';
import { useWalletData } from '@/hooks/useWalletData';
import { signOutFromCognito } from '@/hooks/useCognito';
import { useAuthStore } from '@/stores/authStore';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const clearUserId = useAuthStore((s) => s.clear);
  const { lock } = useWalletData();

  const handleLogout = async () => {
    // Unloads the current wallet's seed from the WDK worklet and clears
    // activeWalletId - without this, a different user logging in afterwards can
    // read balances fetched against this wallet's still-loaded seed.
    lock();
    await signOutFromCognito();
    clearUserId();
    router.replace('/(auth)');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Settings" />
      <View style={styles.container}>
        <TouchableOpacity
          testID="settings-seed"
          style={styles.option}
          onPress={() => router.push('/(wallet)/wallet-setup')}
        >
          <KeyRound size={20} color={colors.primary} />
          <AppText variant="subtitle" style={styles.optionLabel}>Seed Phrase</AppText>
        </TouchableOpacity>

        <TouchableOpacity
          testID="settings-logout"
          style={[styles.option, styles.optionDanger]}
          onPress={handleLogout}
        >
          <LogOut size={20} color={colors.danger} />
          <AppText variant="subtitle" color="danger" style={styles.optionLabel}>Logout</AppText>
        </TouchableOpacity>

        <View style={styles.footer}>
          <AppText variant="caption" color="textSubtle">
            Version {Constants.expoConfig?.version ?? '—'}
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 20,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionDanger: { borderColor: colors.danger },
  optionLabel: { flex: 1 },
  footer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: spacing.lg },
});
