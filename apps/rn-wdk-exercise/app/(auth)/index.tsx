import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCognito } from '@/hooks/useCognito';
import { useThemeColors, useThemedStyles, type ThemeColors } from '@/theme/colors';

export default function LoginScreen() {
  const { promptAsync, ready } = useCognito();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WDK Wallet</Text>
      <Text style={styles.subtitle}>Sign in to access your wallet</Text>

      <TouchableOpacity
        style={[styles.button, !ready && styles.buttonDisabled]}
        onPress={() => promptAsync()}
        disabled={!ready}
      >
        {!ready ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.buttonText}>Sign in with Cognito</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, color: colors.textPrimary },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: 48 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
});
