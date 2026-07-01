import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppLockBiometrics } from '@/hooks/useAppLockBiometrics';

export function AppLockOverlay() {
  const { locked, unlock, verifying } = useAppLockBiometrics();

  if (!locked) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WDK Wallet</Text>
      <Text style={styles.subtitle}>Authenticate to continue</Text>
      <TouchableOpacity style={styles.button} onPress={unlock} disabled={verifying}>
        {verifying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Unlock with Biometrics</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: 32,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 48 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
