import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setUserId = useAuthStore((s) => s.setUserId);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleLogin() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    setError(null);
    setUserId(trimmed);
    router.replace('/(wallet)');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WDK Wallet</Text>
      <Text style={styles.subtitle}>Enter your email to continue</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="done"
        onSubmitEditing={handleLogin}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: 'red', marginBottom: 12 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
