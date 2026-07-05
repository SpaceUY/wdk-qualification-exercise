import * as LocalAuthentication from 'expo-local-authentication';

export function useBiometrics() {
  async function isAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  }

  async function authenticate(reason: string): Promise<boolean> {
    const available = await isAvailable();
    if (!available) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });

    return result.success;
  }

  return { authenticate, isAvailable };
}
