import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppLockBiometrics } from '@/hooks/useAppLockBiometrics';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';

export function AppLockOverlay() {
  const { locked, unlock, verifying } = useAppLockBiometrics();
  const styles = useThemedStyles(createStyles);

  // Prompt biometrics automatically the moment the lock engages, so the user sees
  // the Face ID sheet without tapping. Guarded to fire once per lock episode: if the
  // prompt is cancelled or fails, `locked` stays true and we do NOT re-prompt in a
  // loop — the button below is the manual retry. The ref resets when the app unlocks
  // so a later re-lock (returning from background) prompts again.
  const autoPromptedRef = useRef(false);
  useEffect(() => {
    if (!locked) {
      autoPromptedRef.current = false;
      return;
    }
    if (!autoPromptedRef.current) {
      autoPromptedRef.current = true;
      void unlock();
    }
  }, [locked, unlock]);

  if (!locked) return null;

  return (
    <View style={styles.container}>
      <AppText variant="title" style={styles.title}>WDK Wallet</AppText>
      <AppText color="textMuted" style={styles.subtitle}>Authenticate to continue</AppText>
      <Button
        title="Unlock with Biometrics"
        onPress={unlock}
        loading={verifying}
        style={styles.button}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: spacing.xxl,
  },
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: 48 },
  button: { alignSelf: 'stretch' },
});
