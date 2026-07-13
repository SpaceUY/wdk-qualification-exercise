import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '@tetherto/wdk-react-native-core';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import { Header, HeaderBackTitle } from '@/components/Header';
import { NetworkFundsBanner } from '@/components/NetworkFundsBanner';
import { NetworkDot } from '@/components/NetworkDot';
import { KNOWN_NETWORKS, getNetworkDisplayName, type KnownNetwork } from '@/config/networkMeta';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button, Card, Divider } from '@/components/ui';

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
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header left={<HeaderBackTitle title="Receive" />} />
      <ScrollView contentContainerStyle={styles.container}>
        <NetworkFundsBanner network={selectedNetwork} />

        <Card elevated style={styles.card}>
          <View style={styles.networkRow}>
            {KNOWN_NETWORKS.map((n) => (
              <TouchableOpacity
                key={n}
                testID={`network-chip-${n}`}
                style={[styles.networkChip, selectedNetwork === n && styles.networkChipActive]}
                onPress={() => setSelectedNetwork(n)}
              >
                <NetworkDot network={n} size={7} />
                <AppText variant="caption" style={[styles.networkChipText, selectedNetwork === n && styles.networkChipTextActive]}>
                  {getNetworkDisplayName(n)}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>

          <Divider />

          <View testID="receive-qr" style={styles.qrContainer}>
            {address ? (
              <QRCode value={address} size={220} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <AppText color="textSubtle">Loading address…</AppText>
              </View>
            )}
          </View>

          {address ? (
            <>
              <AppText variant="caption" color="textMuted" style={styles.addressLabel}>Your {selectedNetwork} address</AppText>
              <AppText variant="mono" testID="receive-address" style={styles.address}>{address}</AppText>
              <Button title="Copy Address" onPress={copyAddress} style={styles.copyButton} />
            </>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl },
  card: { alignItems: 'center' },
  networkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  networkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  networkChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  networkChipText: { color: colors.textMuted },
  networkChipTextActive: { color: colors.textOnPrimary },
  // Deliberately white in both themes: the padding acts as the QR's quiet zone,
  // and scanners need dark modules on a light background to read it reliably.
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
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
    borderRadius: radius.sm,
  },
  addressLabel: { marginBottom: 6 },
  address: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 20, paddingHorizontal: spacing.lg },
  copyButton: { paddingHorizontal: spacing.xxl },
});
