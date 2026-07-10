import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { createCloudBackup, restoreFromCloudBackup } from '@/utils/cloudBackup';
import { postWalletBackup } from '@/utils/api';
import { encryptMnemonic } from '@/utils/seedEncryption';

const GOOGLE_SIGN_IN_TIMEOUT_MS = 30000;

// Encrypts a mnemonic client-side and uploads it to the platform's cloud backup (iCloud /
// Google Drive) plus this app's own backend. On Android the ciphertext sent to the backend
// is read back from Google Drive first, proving the two copies match. iCloud's writes are
// eventually consistent, so on iOS we skip that read-back (createCloudBackup() already
// confirms the file exists) and send the ciphertext we already have in memory.
export function useSeedBackup() {
  const { signIn } = useGoogleAuth();
  const [uploading, setUploading] = useState(false);

  async function signInWithTimeout(): Promise<string | null> {
    const timedOut = Symbol('timeout');
    let timeoutId!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<typeof timedOut>((resolve) => {
      timeoutId = setTimeout(() => resolve(timedOut), GOOGLE_SIGN_IN_TIMEOUT_MS);
    });
    const result = await Promise.race([signIn(), timeout]);
    clearTimeout(timeoutId);
    if (result === timedOut) {
      Alert.alert('Backup Failed', 'Google sign-in timed out. Please try again.');
      return null;
    }
    return result;
  }

  async function getCloudCiphertext(walletId: string, accessToken?: string): Promise<string> {
    const ciphertext = await restoreFromCloudBackup(walletId, accessToken);
    if (!ciphertext) throw new Error('Could not read backup ciphertext from cloud storage');
    return ciphertext;
  }

  // Returns true if the backup was actually uploaded, false if the user cancelled (e.g.
  // Google sign-in) before anything was sent — callers use this to decide whether to show
  // a success message. Throws on any failure past that point.
  async function backupToCloud(userId: string, mnemonic: string, passphrase: string): Promise<boolean> {
    setUploading(true);
    try {
      const ciphertext = await encryptMnemonic(mnemonic, passphrase);

      if (Platform.OS === 'ios') {
        await createCloudBackup(ciphertext, userId);
        // createCloudBackup() already verifies the file exists right after writing it —
        // re-reading it back from iCloud here just races iCloud's eventual-consistency
        // sync and can block the UI for many seconds. Send the ciphertext we already have.
        await postWalletBackup(ciphertext);
        return true;
      }

      const accessToken = await signInWithTimeout();
      if (!accessToken) return false;
      await createCloudBackup(ciphertext, userId, accessToken);
      await postWalletBackup(await getCloudCiphertext(userId, accessToken));
      return true;
    } finally {
      setUploading(false);
    }
  }

  return { uploading, backupToCloud };
}
