import { Stack } from 'expo-router';

export default function WalletSetupLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Wallet Options' }} />
      <Stack.Screen name="backup" options={{ title: 'Seed Phrase' }} />
      <Stack.Screen name="restore" options={{ title: 'Restore Wallet' }} />
      <Stack.Screen name="restore-cloud" options={{ title: 'Restore from Google Drive' }} />
    </Stack>
  );
}
