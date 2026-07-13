import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { restoreFromCloudBackup } from '@/utils/cloudBackup';
import { decryptMnemonic } from '@/utils/seedEncryption';
import { PassphraseInput } from '@/components/PassphraseInput';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';

export default function RestoreCloudScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.userId);
  const { restoreWallet } = useWalletData();
  const { signIn } = useGoogleAuth();
  const [loading, setLoading] = useState(false);
  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false);
  const [pendingCiphertext, setPendingCiphertext] = useState<string | null>(null);

  async function handleRestore() {
    if (!userId) return;
    setLoading(true);
    try {
      let accessToken: string | undefined;
      if (Platform.OS === 'android') {
        const token = await signIn();
        if (!token) return;
        accessToken = token;
      }

      const ciphertext = await restoreFromCloudBackup(userId, accessToken);
      if (!ciphertext) {
        Alert.alert('No Backup Found', 'No cloud backup was found for this account.');
        return;
      }

      setPendingCiphertext(ciphertext);
      setShowPassphrasePrompt(true);
    } catch (err) {
      Alert.alert(
        'Restore Failed',
        err instanceof Error ? err.message : 'Could not restore from cloud backup.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function completeRestore(passphrase: string) {
    setShowPassphrasePrompt(false);
    if (!userId || !pendingCiphertext) return;

    try {
      const mnemonic = await decryptMnemonic(pendingCiphertext, passphrase);
      await restoreWallet(mnemonic, userId);
      Alert.alert('Wallet Restored', 'Your wallet has been restored from your cloud backup.', [
        { text: 'OK', onPress: () => router.replace('/(wallet)') },
      ]);
    } catch (err) {
      Alert.alert(
        'Restore Failed',
        err instanceof Error ? err.message : 'Could not restore from cloud backup.',
      );
    } finally {
      setPendingCiphertext(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Restore from Cloud Backup" />
      <View style={styles.container}>
        <AppText color="textMuted" style={styles.subtitle}>
          {Platform.OS === 'android'
            ? "Sign in with the Google account you used to back up your wallet. You'll then enter your backup passphrase to restore it."
            : "We'll look for a backup in your iCloud account. You'll then enter your backup passphrase to restore it."}
        </AppText>

        <Button
          title={Platform.OS === 'android' ? 'Sign in with Google' : 'Restore from iCloud'}
          onPress={handleRestore}
          loading={loading}
        />

        {showPassphrasePrompt ? (
          <PassphraseInput
            submitLabel="Decrypt & Restore"
            onSubmit={completeRestore}
            onCancel={() => {
              setShowPassphrasePrompt(false);
              setPendingCiphertext(null);
            }}
            validateStrength={false}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  subtitle: { marginTop: spacing.lg, marginBottom: spacing.xxl },
});
