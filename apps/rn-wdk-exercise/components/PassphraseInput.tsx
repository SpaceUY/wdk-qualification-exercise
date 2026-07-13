import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { MIN_PASSPHRASE_LENGTH, validatePassphraseStrength } from '@/utils/seedEncryption';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';

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
      <AppText variant="subtitle" style={styles.label}>Backup Passphrase</AppText>
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
      {error ? (
        <AppText variant="caption" color="dangerStrong" style={styles.error}>{error}</AppText>
      ) : null}
      <Button title={submitLabel} onPress={handleSubmit} style={styles.submitButton} />
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.md, margin: spacing.xl },
  label: { marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  error: { marginBottom: spacing.md },
  submitButton: { marginBottom: spacing.sm },
});
