import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { restoreFromCloudBackup } from '@/utils/cloudBackup';
import { decryptMnemonic } from '@/utils/seedEncryption';
import { PassphraseInput } from '@/components/PassphraseInput';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function RestoreCloudScreen() {
  const router = useRouter();
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
        <Text style={styles.subtitle}>
          {Platform.OS === 'android'
            ? "Sign in with the Google account you used to back up your wallet. You'll then enter your backup passphrase to restore it."
            : "We'll look for a backup in your iCloud account. You'll then enter your backup passphrase to restore it."}
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleRestore} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {Platform.OS === 'android' ? 'Sign in with Google' : 'Restore from iCloud'}
            </Text>
          )}
        </TouchableOpacity>

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  subtitle: { fontSize: 15, color: '#6b7280', marginTop: 16, marginBottom: 32, lineHeight: 22 },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
