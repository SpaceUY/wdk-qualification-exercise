import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { restoreFromCloudBackup } from '@/utils/cloudBackup';
import { decryptMnemonic } from '@/utils/seedEncryption';
import { PassphraseInput } from '@/components/PassphraseInput';
import { Header, HeaderBackTitle } from '@/components/Header';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';

export default function RestoreCloudScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.userId);
  const { restoreWallet, createWallet, hasLocalWallet } = useWalletData();
  const { signIn } = useGoogleAuth();
  const [loading, setLoading] = useState(false);
  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false);
  const [pendingCiphertext, setPendingCiphertext] = useState<string | null>(null);
  // The rescue path only applies when the bootstrap redirected here because the backend
  // has a backup but no wallet exists on this device. Entering manually (from the
  // wallet-setup menu, local wallet already present) must keep the current behavior.
  const [walletMissingLocally, setWalletMissingLocally] = useState(false);
  const [cloudBackupNotFound, setCloudBackupNotFound] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    hasLocalWallet(userId)
      .then((hasWallet) => {
        if (!cancelled) setWalletMissingLocally(!hasWallet);
      })
      .catch(() => {
        // Can't tell — keep the rescue button hidden rather than offer a destructive
        // escape hatch on uncertain state.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
        setCloudBackupNotFound(true);
        Alert.alert('No Backup Found', 'No cloud backup was found for this account.');
        return;
      }
      setCloudBackupNotFound(false);

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

  async function handleStartFresh() {
    if (!userId) return;
    setCreating(true);
    try {
      await createWallet(userId);
      router.replace('/(wallet)');
    } catch (err) {
      Alert.alert(
        'Could Not Create Wallet',
        err instanceof Error ? err.message : 'Could not create a new wallet.',
      );
    } finally {
      setCreating(false);
    }
  }

  // Last-resort escape hatch, only after the automatic restore attempt already failed:
  // the backend says a backup exists, but the device's native cloud storage
  // (iCloud/Google Drive) has none to offer. Never shown on manual entry with a local
  // wallet present.
  const showStartFresh = walletMissingLocally && cloudBackupNotFound && !showPassphrasePrompt;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header left={<HeaderBackTitle title="Restore from Cloud Backup" />} />
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

        {showStartFresh ? (
          <View style={styles.startFreshSection}>
            <AppText color="textMuted" style={styles.startFreshWarning}>
              Couldn't find your backup in this device's cloud storage? As a last resort you
              can start over with a new, empty wallet. This is permanent: if you find your
              backup later, you won't be able to recover it from here.
            </AppText>
            <Button
              title="Start a New Wallet"
              variant="secondary"
              onPress={handleStartFresh}
              loading={creating}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  subtitle: { marginTop: spacing.lg, marginBottom: spacing.xxl },
  startFreshSection: { marginTop: spacing.xxl },
  startFreshWarning: { marginBottom: spacing.lg },
});
