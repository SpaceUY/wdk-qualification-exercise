import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppLockBiometrics } from '@/hooks/useAppLockBiometrics';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';

export function AppLockOverlay() {
  const { locked, unlock, verifying } = useAppLockBiometrics();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  if (!locked) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WDK Wallet</Text>
      <Text style={styles.subtitle}>Authenticate to continue</Text>
      <TouchableOpacity style={styles.button} onPress={unlock} disabled={verifying}>
        {verifying ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.buttonText}>Unlock with Biometrics</Text>
        )}
      </TouchableOpacity>
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
    padding: 32,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, color: colors.textPrimary },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: 48 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
});
