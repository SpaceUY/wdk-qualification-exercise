import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { createCloudBackup, restoreFromCloudBackup } from '@/utils/cloudBackup';
import { postWalletBackup } from '@/utils/api';
import { encryptMnemonic } from '@/utils/seedEncryption';

const GOOGLE_SIGN_IN_TIMEOUT_MS = 30000;

// Encrypts a mnemonic client-side and uploads it to the platform's cloud backup (iCloud /
// Google Drive) plus this app's own backend, mirroring the ciphertext read back from the
// cloud so the two copies are proven to match before returning.
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
        await postWalletBackup(await getCloudCiphertext(userId));
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
