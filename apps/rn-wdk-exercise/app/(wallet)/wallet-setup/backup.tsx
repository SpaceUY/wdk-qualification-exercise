import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { toast } from 'sonner-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useWalletData } from '@/hooks/useWalletData';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useSeedBackup } from '@/hooks/useSeedBackup';
import { PassphraseInput } from '@/components/PassphraseInput';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';

export default function BackupScreen() {
  // Blocks screenshots/screen recording (and Android's app-switcher preview) while
  // this screen is mounted — a captured seed phrase is a fully compromised wallet.
  usePreventScreenCapture();

  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.userId);
  const { getMnemonic } = useWalletData();
  const { authenticate } = useBiometrics();
  const { uploading, backupToCloud } = useSeedBackup();

  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());
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
      setRevealedWords(new Set());
    } catch {
      Alert.alert('Error', 'Could not retrieve seed phrase');
    } finally {
      setLoading(false);
    }
  }

  function toggleWord(index: number) {
    setRevealedWords((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function copy() {
    if (!mnemonic) return;
    await Clipboard.setStringAsync(mnemonic);
    toast.success('Copied', { description: 'Store it securely and never share it.' });
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
      const uploaded = await backupToCloud(userId, mnemonic, passphrase);
      if (uploaded) {
        // Success is a toast (non-blocking confirmation); errors stay as alerts.
        toast.success('Backed Up', {
          description:
            Platform.OS === 'ios'
              ? 'Seed phrase backed up to iCloud and our servers.'
              : 'Seed phrase backed up to Google Drive and our servers.',
        });
      }
    } catch (err) {
      Alert.alert('Backup Failed', err instanceof Error ? err.message : 'Backup failed.');
    }
  }

  const words = mnemonic?.split(' ') ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Seed Phrase" />
      <View style={styles.container}>
        <AppText variant="caption" color="warningText" style={styles.warning}>
          Never share your seed phrase. Anyone with it has full access to your wallet.
        </AppText>

        {!revealed ? (
          <TouchableOpacity style={styles.revealButton} onPress={reveal} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <AppText variant="subtitle" color="textOnPrimary">Reveal Seed Phrase</AppText>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <AppText variant="caption" color="textSubtle" style={styles.tapHint}>Tap a word to reveal it.</AppText>
            <View style={styles.grid}>
              {words.map((word, i) => {
                const isWordRevealed = revealedWords.has(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.wordCard}
                    onPress={() => toggleWord(i)}
                    testID={`seed-word-${i}`}
                  >
                    <AppText variant="caption" color="textSubtle" style={styles.wordIndex}>{i + 1}</AppText>
                    <AppText>{isWordRevealed ? word : '••••••'}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button title="Copy to Clipboard" variant="secondary" onPress={copy} style={styles.copyButton} />

            <Button
              title={Platform.OS === 'ios' ? 'Upload to iCloud' : 'Upload to Google Drive'}
              onPress={uploadToCloud}
              disabled={uploading}
            />
          </>
        )}

        <Modal
          visible={showPassphrasePrompt}
          animationType="slide"
          transparent
          onRequestClose={() => setShowPassphrasePrompt(false)}
        >
          <View style={styles.modalOverlay}>
            <PassphraseInput
              confirm
              submitLabel="Encrypt & Upload"
              onSubmit={performUpload}
              onCancel={() => setShowPassphrasePrompt(false)}
            />
          </View>
        </Modal>

        {uploading ? (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color={colors.textPrimary} />
            <AppText variant="subtitle" style={styles.uploadingText}>Backing up seed phrase...</AppText>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  warning: {
    backgroundColor: colors.warningBg,
    padding: 14,
    borderRadius: radius.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  revealButton: {
    backgroundColor: colors.dangerStrong,
    borderRadius: radius.sm,
    padding: spacing.lg,
    alignItems: 'center',
  },
  tapHint: { marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  wordCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: '30%',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordIndex: { minWidth: 16 },
  copyButton: { marginBottom: spacing.md },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: { marginTop: spacing.md },
});
