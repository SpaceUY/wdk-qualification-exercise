import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { restoreFromCloudBackup } from '@/utils/cloudBackup';

export default function RestoreCloudScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { restoreWallet } = useWalletData();
  const { signIn } = useGoogleAuth();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    if (!userId) return;
    setLoading(true);
    try {
      const accessToken = await signIn();
      if (!accessToken) return;

      const mnemonic = await restoreFromCloudBackup(userId, accessToken);
      if (!mnemonic) {
        Alert.alert('No Backup Found', 'No Google Drive backup was found for this account.');
        return;
      }

      await restoreWallet(mnemonic, userId);
      Alert.alert('Wallet Restored', 'Your wallet has been restored from Google Drive.', [
        { text: 'OK', onPress: () => router.replace('/(wallet)') },
      ]);
    } catch (err) {
      Alert.alert('Restore Failed', err instanceof Error ? err.message : 'Could not restore from Google Drive.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Restore from Google Drive</Text>
      <Text style={styles.subtitle}>
        Sign in with the Google account you used to back up your wallet. Your seed phrase will be
        downloaded and your wallet restored.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleRestore} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Google</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 32, lineHeight: 22 },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
