import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { createCloudBackup, restoreFromCloudBackup } from '@/utils/cloudBackup';
import { postWalletBackup } from '@/utils/api';
import { encryptMnemonic } from '@/utils/seedEncryption';
import { PassphraseInput } from '@/components/PassphraseInput';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function BackupScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { getMnemonic } = useWalletData();
  const { authenticate } = useBiometrics();
  const { signIn } = useGoogleAuth();

  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false);

  async function reveal() {
    if (!userId) return;

    const granted = await authenticate('Reveal your seed phrase');
    if (!granted) return;

    setLoading(true);
    try {
      const phrase = await getMnemonic(userId);
      setMnemonic(phrase);
      setRevealed(true);
    } catch {
      Alert.alert('Error', 'Could not retrieve seed phrase');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!mnemonic) return;
    await Clipboard.setStringAsync(mnemonic);
    Alert.alert('Copied', 'Seed phrase copied. Store it securely and never share it.');
  }

  async function uploadToCloud() {
    if (!userId || !mnemonic) return;
    const granted = await authenticate('Authorize cloud backup');
    if (!granted) return;
    setShowPassphrasePrompt(true);
  }

  async function performUpload(passphrase: string) {
    setShowPassphrasePrompt(false);
    if (!userId || !mnemonic) return;

    try {
      const ciphertext = await encryptMnemonic(mnemonic, passphrase);

      if (Platform.OS === 'ios') {
        await createCloudBackup(ciphertext, userId);
        await postWalletBackup(await getCloudCiphertext(userId));
        Alert.alert('Backed Up', 'Seed phrase backed up to iCloud and our servers.');
      } else {
        const accessToken = await signIn();
        if (!accessToken) return;
        await createCloudBackup(ciphertext, userId, accessToken);
        await postWalletBackup(await getCloudCiphertext(userId, accessToken));
        Alert.alert('Backed Up', 'Seed phrase backed up to Google Drive and our servers.');
      }
    } catch (err) {
      Alert.alert('Backup Failed', err instanceof Error ? err.message : 'Backup failed.');
    }
  }

  async function getCloudCiphertext(walletId: string, accessToken?: string): Promise<string> {
    const ciphertext = await restoreFromCloudBackup(walletId, accessToken);
    if (!ciphertext) throw new Error('Could not read backup ciphertext from cloud storage');
    return ciphertext;
  }

  const words = mnemonic?.split(' ') ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Seed Phrase" />
      <View style={styles.container}>
        <Text style={styles.warning}>
          ⚠️ Never share your seed phrase. Anyone with it has full access to your wallet.
        </Text>

        {!revealed ? (
          <TouchableOpacity style={styles.revealButton} onPress={reveal} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.revealButtonText}>Reveal Seed Phrase</Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.grid}>
              {words.map((word, i) => (
                <View key={i} style={styles.wordCard}>
                  <Text style={styles.wordIndex}>{i + 1}</Text>
                  <Text style={styles.word}>{word}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.copyButton} onPress={copy}>
              <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
              <TouchableOpacity style={styles.icloudButton} onPress={uploadToCloud}>
                <Text style={styles.icloudButtonText}>Upload to iCloud</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.driveButton} onPress={uploadToCloud}>
                <Text style={styles.driveButtonText}>Upload to Google Drive</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <Modal visible={showPassphrasePrompt} animationType="slide" transparent>
          <PassphraseInput
            confirm
            submitLabel="Encrypt & Upload"
            onSubmit={performUpload}
            onCancel={() => setShowPassphrasePrompt(false)}
          />
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  warning: {
    color: '#b45309',
    backgroundColor: '#fef3c7',
    padding: 14,
    borderRadius: 8,
    fontSize: 13,
    marginTop: 16,
    marginBottom: 24,
  },
  revealButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  revealButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  wordCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: '30%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordIndex: { fontSize: 11, color: '#9ca3af', minWidth: 16 },
  word: { fontSize: 14, fontWeight: '500' },
  copyButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  copyButtonText: { color: '#374151', fontSize: 15 },
  icloudButton: {
    backgroundColor: '#0070c9',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  icloudButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  driveButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  driveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
