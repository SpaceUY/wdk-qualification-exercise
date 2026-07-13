import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header, HeaderBackTitle } from '@/components/Header';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

export default function WalletSetupScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header left={<HeaderBackTitle title="Wallet Options" />} />
      <View style={styles.container}>
        <AppText color="textMuted" style={styles.subtitle}>Manage your seed phrase</AppText>

        <TouchableOpacity
          style={styles.option}
          onPress={() => router.push('/(wallet)/wallet-setup/backup')}
        >
          <AppText variant="subtitle" style={styles.optionTitle}>View Seed Phrase</AppText>
          <AppText variant="caption" color="textMuted">See your 12-word recovery phrase. Keep it safe.</AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
          onPress={() => router.push('/(wallet)/wallet-setup/restore-cloud')}
        >
          <AppText variant="subtitle" style={styles.optionTitle}>Restore from Cloud Backup</AppText>
          <AppText variant="caption" color="textMuted">Recover your wallet from a previous cloud backup.</AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, styles.optionDanger]}
          onPress={() => router.push('/(wallet)/wallet-setup/restore')}
        >
          <AppText variant="subtitle" color="dangerStrong" style={styles.optionTitle}>Restore Wallet</AppText>
          <AppText variant="caption" color="textMuted">Import a wallet using an existing seed phrase.</AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  subtitle: { marginTop: spacing.lg, marginBottom: spacing.xxl },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 20,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionDanger: { borderColor: colors.danger },
  optionTitle: { marginBottom: 6 },
});
