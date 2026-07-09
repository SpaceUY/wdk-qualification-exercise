import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';

export default function WalletSetupScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Wallet Options" />
      <View style={styles.container}>
        <Text style={styles.subtitle}>Manage your seed phrase</Text>

        <TouchableOpacity
          style={styles.option}
          onPress={() => router.push('/(wallet)/wallet-setup/backup')}
        >
          <Text style={styles.optionTitle}>View Seed Phrase</Text>
          <Text style={styles.optionDesc}>See your 12-word recovery phrase. Keep it safe.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
          onPress={() => router.push('/(wallet)/wallet-setup/restore-cloud')}
        >
          <Text style={styles.optionTitle}>Restore from Cloud Backup</Text>
          <Text style={styles.optionDesc}>Recover your wallet from a previous cloud backup.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, styles.optionDanger]}
          onPress={() => router.push('/(wallet)/wallet-setup/restore')}
        >
          <Text style={[styles.optionTitle, { color: colors.dangerStrong }]}>Restore Wallet</Text>
          <Text style={styles.optionDesc}>Import a wallet using an existing seed phrase.</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 16, marginBottom: 32 },
  option: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionDanger: { borderColor: colors.danger },
  optionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6, color: colors.textPrimary },
  optionDesc: { fontSize: 14, color: colors.textMuted },
});
