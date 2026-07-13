import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { parseMerchantQR } from '@/utils/merchantQR';
import { useThemedStyles, type ThemeColors } from '@/theme/colors';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';

export default function QRScanScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <AppText style={styles.permText}>Camera permission is required to scan QR codes.</AppText>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  function handleScan({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    const { address, amount } = parseMerchantQR(data);

    router.navigate({
      pathname: '/(wallet)/send',
      params: {
        scannedAddress: address,
        ...(amount !== null ? { scannedAmount: amount } : {}),
      },
    });
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <AppText variant="caption" style={styles.hint}>Align QR code within the frame</AppText>
      </View>
      <TouchableOpacity
        style={[styles.cancelButton, { bottom: 48 + insets.bottom }]}
        onPress={() => router.back()}
      >
        <AppText variant="subtitle" style={styles.cancelText}>Cancel</AppText>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background },
  permText: { textAlign: 'center', marginBottom: spacing.lg },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  // Camera chrome is intentionally theme-independent: it sits on the live camera
  // feed, not on an app surface, so it must stay white-on-dark in both themes.
  frame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', fontSize: 14, marginTop: 20 },
  cancelButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
  },
  cancelText: { color: '#fff', fontSize: 16 },
});
