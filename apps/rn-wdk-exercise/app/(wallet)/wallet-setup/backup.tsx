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

export default function BackupScreen() {
  // Blocks screenshots/screen recording (and Android's app-switcher preview) while
  // this screen is mounted — a captured seed phrase is a fully compromised wallet.
  usePreventScreenCapture();

  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.userId);
  const { getMnemonic } = useWalletData();
  const { authenticate } = useBiometrics();
  const { uploading, stage, encryptProgress, backupToCloud } = useSeedBackup();

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
        <Text style={styles.warning}>
          Never share your seed phrase. Anyone with it has full access to your wallet.
        </Text>

        {!revealed ? (
          <TouchableOpacity style={styles.revealButton} onPress={reveal} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.revealButtonText}>Reveal Seed Phrase</Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.tapHint}>Tap a word to reveal it.</Text>
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
                    <Text style={styles.wordIndex}>{i + 1}</Text>
                    <Text style={styles.word}>{isWordRevealed ? word : '••••••'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.copyButton} onPress={copy}>
              <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
              <TouchableOpacity
                style={styles.icloudButton}
                onPress={uploadToCloud}
                disabled={uploading}
              >
                <Text style={styles.icloudButtonText}>Upload to iCloud</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.driveButton}
                onPress={uploadToCloud}
                disabled={uploading}
              >
                <Text style={styles.driveButtonText}>Upload to Google Drive</Text>
              </TouchableOpacity>
            )}
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
            <ActivityIndicator size="large" color={colors.textOnPrimary} />
            <Text style={styles.uploadingText}>
              {stage === 'encrypting' ? 'Encrypting seed phrase...' : 'Uploading backup...'}
            </Text>
            {stage === 'encrypting' ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${encryptProgress * 100}%` }]} />
                </View>
                <Text style={styles.uploadingHint}>This can take a few seconds on some devices.</Text>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  warning: {
    color: colors.warningText,
    backgroundColor: colors.warningBg,
    padding: 14,
    borderRadius: 8,
    fontSize: 13,
    marginTop: 16,
    marginBottom: 24,
  },
  revealButton: {
    backgroundColor: colors.dangerStrong,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  revealButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
  tapHint: { fontSize: 12, color: colors.textSubtle, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  wordCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: '30%',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordIndex: { fontSize: 11, color: colors.textSubtle, minWidth: 16 },
  word: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  copyButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  copyButtonText: { color: colors.textMuted, fontSize: 15 },
  icloudButton: {
    backgroundColor: '#0070c9',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  icloudButtonText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600' },
  driveButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  driveButtonText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600', marginTop: 12 },
  progressTrack: {
    width: 180,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.textOnPrimary },
  uploadingHint: { color: colors.textOnPrimary, fontSize: 12, marginTop: 10, opacity: 0.8 },
});