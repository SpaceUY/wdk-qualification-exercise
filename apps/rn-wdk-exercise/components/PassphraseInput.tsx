import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MIN_PASSPHRASE_LENGTH, validatePassphraseStrength } from '@/utils/seedEncryption';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';

type PassphraseInputProps = {
  confirm?: boolean;
  submitLabel: string;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
  validateStrength?: boolean;
};

export function PassphraseInput({
  confirm = false,
  submitLabel,
  onSubmit,
  onCancel,
  validateStrength = true,
}: PassphraseInputProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  function handleSubmit() {
    const strengthError = validateStrength
      ? validatePassphraseStrength(passphrase)
      : passphrase.length < MIN_PASSPHRASE_LENGTH
        ? `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`
        : null;
    if (strengthError) {
      setError(strengthError);
      return;
    }
    if (confirm && passphrase !== confirmation) {
      setError('Passphrases do not match.');
      return;
    }
    setError(null);
    onSubmit(passphrase);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Backup Passphrase</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter passphrase"
        placeholderTextColor={colors.textSubtle}
        secureTextEntry
        autoComplete="off"
        textContentType="none"
        value={passphrase}
        onChangeText={setPassphrase}
        testID="passphrase-input"
      />
      {confirm ? (
        <TextInput
          style={styles.input}
          placeholder="Confirm passphrase"
          placeholderTextColor={colors.textSubtle}
          secureTextEntry
          autoComplete="off"
          textContentType="none"
          value={confirmation}
          onChangeText={setConfirmation}
          testID="passphrase-confirm-input"
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>{submitLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { padding: 24, backgroundColor: colors.surface, borderRadius: 12, margin: 24 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  error: { color: colors.dangerStrong, fontSize: 13, marginBottom: 12 },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  submitButtonText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600' },
  cancelButton: { padding: 14, alignItems: 'center' },
  cancelButtonText: { color: colors.textMuted, fontSize: 15 },
});
