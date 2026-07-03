import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useWallet } from '@tetherto/wdk-react-native-core';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

const NETWORKS = ['ethereum', 'arbitrum', 'polygon', 'bitcoin', 'spark', 'tron'] as const;
type Network = (typeof NETWORKS)[number];

export default function ReceiveScreen() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('ethereum');

  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const address = addresses[selectedNetwork]?.[0] ?? null;

  async function copyAddress() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    Alert.alert('Copied', 'Address copied to clipboard');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Receive</Text>

      <View style={styles.networkRow}>
        {NETWORKS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.networkChip, selectedNetwork === n && styles.networkChipActive]}
            onPress={() => setSelectedNetwork(n)}
          >
            <Text style={[styles.networkChipText, selectedNetwork === n && styles.networkChipTextActive]}>
              {n.charAt(0).toUpperCase() + n.slice(1, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.qrContainer}>
        {address ? (
          <QRCode value={address} size={220} />
        ) : (
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrPlaceholderText}>Loading address…</Text>
          </View>
        )}
      </View>

      {address ? (
        <>
          <Text style={styles.addressLabel}>Your {selectedNetwork} address</Text>
          <Text style={styles.address}>{address}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyAddress}>
            <Text style={styles.copyButtonText}>Copy Address</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20, alignSelf: 'flex-start' },
  networkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  networkChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  networkChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  networkChipText: { fontSize: 13, color: '#374151' },
  networkChipTextActive: { color: '#fff' },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  qrPlaceholderText: { color: '#9ca3af' },
  addressLabel: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  address: { fontSize: 13, color: '#111', textAlign: 'center', marginBottom: 20, paddingHorizontal: 16 },
  copyButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  copyButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
