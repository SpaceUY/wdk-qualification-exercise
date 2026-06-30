import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCognito } from '@/hooks/useCognito';

export default function LoginScreen() {
  const { promptAsync, ready } = useCognito();

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
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Cognito</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 48 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
