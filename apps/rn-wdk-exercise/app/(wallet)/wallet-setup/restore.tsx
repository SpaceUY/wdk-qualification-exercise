import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { validateMnemonic } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { Header, HeaderBackTitle } from '@/components/Header';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

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
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header left={<HeaderBackTitle title="Restore Wallet" />} />
      <ScrollView contentContainerStyle={styles.container}>
        <AppText color="textMuted" style={styles.subtitle}>
          Enter your 12 or 24-word seed phrase separated by spaces.
        </AppText>

        <AppText variant="caption" color="warningText" style={styles.warning}>
          ⚠️ This will replace your current wallet. Your existing funds will only be accessible via the old seed phrase.
        </AppText>

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

        {error ? <AppText color="danger" style={styles.error}>{error}</AppText> : null}

        <TouchableOpacity style={styles.button} onPress={handleRestore} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <AppText variant="subtitle" color="textOnPrimary">Restore Wallet</AppText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { padding: spacing.xl },
  subtitle: { marginTop: spacing.lg, marginBottom: spacing.lg },
  warning: {
    backgroundColor: colors.warningBg,
    padding: 14,
    borderRadius: radius.sm,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  error: { marginBottom: spacing.md },
  button: {
    backgroundColor: colors.dangerStrong,
    borderRadius: radius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
