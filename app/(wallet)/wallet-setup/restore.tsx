import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { validateMnemonic } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';

export default function RestoreWalletScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { restoreWallet } = useWalletData();

  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    const normalized = phrase.toLowerCase().trim().split(/\s+/).join(' ');
    const wordCount = normalized.split(' ').length;

    if (wordCount !== 12 && wordCount !== 24) {
      setError('Seed phrase must be 12 or 24 words');
      return;
    }

    if (!validateMnemonic(normalized)) {
      setError('Invalid seed phrase — check the words and order');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await restoreWallet(normalized, userId ?? '');
      Alert.alert('Wallet Restored', 'Your wallet has been restored successfully.', [
        { text: 'OK', onPress: () => router.replace('/(wallet)') },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Restore Wallet</Text>
      <Text style={styles.subtitle}>
        Enter your 12 or 24-word seed phrase separated by spaces.
      </Text>

      <Text style={styles.warning}>
        ⚠️ This will replace your current wallet. Your existing funds will only be accessible via the old seed phrase.
      </Text>

      <TextInput
        style={styles.input}
        value={phrase}
        onChangeText={setPhrase}
        placeholder="word1 word2 word3 …"
        multiline
        numberOfLines={5}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleRestore} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Restore Wallet</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 16 },
  warning: {
    color: '#b45309',
    backgroundColor: '#fef3c7',
    padding: 14,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#fff',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  error: { color: '#ef4444', marginBottom: 12 },
  button: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
