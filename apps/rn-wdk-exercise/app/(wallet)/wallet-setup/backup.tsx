import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { createCloudBackup } from '@/utils/cloudBackup';

export default function BackupScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { getMnemonic } = useWalletData();
  const { authenticate } = useBiometrics();
  const { signIn } = useGoogleAuth();

  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

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

    if (Platform.OS === 'ios') {
      try {
        await createCloudBackup(mnemonic, userId);
        Alert.alert('Backed Up', 'Seed phrase uploaded to iCloud securely.');
      } catch (err) {
        Alert.alert('Backup Failed', err instanceof Error ? err.message : 'Could not back up to iCloud.');
      }
    } else {
      try {
        const accessToken = await signIn();
        if (!accessToken) return;
        await createCloudBackup(mnemonic, userId, accessToken);
        Alert.alert('Backed Up', 'Seed phrase uploaded to Google Drive securely.');
      } catch (err) {
        Alert.alert('Backup Failed', err instanceof Error ? err.message : 'Could not back up to Google Drive.');
      }
    }
  }

  const words = mnemonic?.split(' ') ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seed Phrase</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  warning: {
    color: '#b45309',
    backgroundColor: '#fef3c7',
    padding: 14,
    borderRadius: 8,
    fontSize: 13,
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
