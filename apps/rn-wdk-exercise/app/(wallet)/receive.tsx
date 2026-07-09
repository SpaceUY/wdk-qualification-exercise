import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '@tetherto/wdk-react-native-core';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NetworkFundsBanner } from '@/components/NetworkFundsBanner';
import { NetworkDot } from '@/components/NetworkDot';
import { KNOWN_NETWORKS, getNetworkDisplayName, type KnownNetwork } from '@/config/networkMeta';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';

export default function ReceiveScreen() {
  const styles = useThemedStyles(createStyles);
  const [selectedNetwork, setSelectedNetwork] = useState<KnownNetwork>('ethereum');

  const { addresses } = useWallet({ autoLoadAccountIndices: [0] });
  const address = addresses[selectedNetwork]?.[0] ?? null;

  async function copyAddress() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    toast.success('Copied', { description: 'Address copied to clipboard' });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Receive" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.networkRow}>
          {KNOWN_NETWORKS.map((n) => (
            <TouchableOpacity
              key={n}
              testID={`network-chip-${n}`}
              style={[styles.networkChip, selectedNetwork === n && styles.networkChipActive]}
              onPress={() => setSelectedNetwork(n)}
            >
              <NetworkDot network={n} size={7} />
              <Text style={[styles.networkChipText, selectedNetwork === n && styles.networkChipTextActive]}>
                {getNetworkDisplayName(n)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <NetworkFundsBanner network={selectedNetwork} />

        <View testID="receive-qr" style={styles.qrContainer}>
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
            <Text testID="receive-address" style={styles.address}>{address}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyAddress}>
              <Text style={styles.copyButtonText}>Copy Address</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, alignItems: 'center' },
  networkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  networkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  networkChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  networkChipText: { fontSize: 13, color: colors.textMuted },
  networkChipTextActive: { color: colors.textOnPrimary },
  // Deliberately white in both themes: the padding acts as the QR's quiet zone,
  // and scanners need dark modules on a light background to read it reliably.
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
  },
  qrPlaceholderText: { color: colors.textSubtle },
  addressLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  address: { fontSize: 13, color: colors.textPrimary, textAlign: 'center', marginBottom: 20, paddingHorizontal: 16 },
  copyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  copyButtonText: { color: colors.textOnPrimary, fontWeight: '600', fontSize: 15 },
});
