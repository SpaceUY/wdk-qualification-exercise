import { Stack } from 'expo-router';

export default function SendLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Send' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan QR Code', presentation: 'fullScreenModal' }} />
      <Stack.Screen name="confirm" options={{ title: 'Confirm' }} />
    </Stack>
  );
}
