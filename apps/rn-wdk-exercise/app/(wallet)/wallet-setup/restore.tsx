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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { validateMnemonic } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';

export default function RestoreWalletScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
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
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Restore Wallet" />
      <ScrollView contentContainerStyle={styles.container}>
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
          placeholderTextColor={colors.textSubtle}
          multiline
          numberOfLines={5}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleRestore} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>Restore Wallet</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 24 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 16, marginBottom: 16 },
  warning: {
    color: colors.warningText,
    backgroundColor: colors.warningBg,
    padding: 14,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  error: { color: colors.danger, marginBottom: 12 },
  button: {
    backgroundColor: colors.dangerStrong,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
});
