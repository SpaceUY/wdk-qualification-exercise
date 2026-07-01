import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function WalletSetupScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wallet Options</Text>
      <Text style={styles.subtitle}>Manage your seed phrase</Text>

      <TouchableOpacity style={styles.option} onPress={() => router.push('/(wallet)/wallet-setup/backup')}>
        <Text style={styles.optionTitle}>View Seed Phrase</Text>
        <Text style={styles.optionDesc}>See your 12-word recovery phrase. Keep it safe.</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' ? (
        <TouchableOpacity
          style={styles.option}
          onPress={() => router.push('/(wallet)/wallet-setup/restore-cloud')}
        >
          <Text style={styles.optionTitle}>Restore from Google Drive</Text>
          <Text style={styles.optionDesc}>Recover your wallet from a previous Google Drive backup.</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.option, styles.optionDanger]}
        onPress={() => router.push('/(wallet)/wallet-setup/restore')}
      >
        <Text style={[styles.optionTitle, { color: '#dc2626' }]}>Restore Wallet</Text>
        <Text style={styles.optionDesc}>Import a wallet using an existing seed phrase.</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 32 },
  option: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionDanger: { borderColor: '#fca5a5' },
  optionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  optionDesc: { fontSize: 14, color: '#6b7280' },
});
