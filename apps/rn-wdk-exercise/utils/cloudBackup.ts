import { Platform } from 'react-native';
import {
  CloudBackup,
  ICloudProvider,
  GoogleDriveProvider,
  CloudUnavailableError,
} from '@tetherto/wdk-backup-cloud-react-native';

function getCloudBackup(walletId: string, accessToken?: string): CloudBackup | null {
  const safe = walletId.replace(/[^a-zA-Z0-9]/g, '_');
  if (Platform.OS === 'ios') {
    return new CloudBackup(
      new ICloudProvider({ cloudEmail: walletId, filePath: `wallet_backup_${safe}.json` }),
    );
  }
  if (Platform.OS === 'android' && accessToken) {
    return new CloudBackup(
      new GoogleDriveProvider({
        accessToken,
        filePath: `wallet_backup_${safe}.json`,
        cloudEmail: walletId,
      }),
    );
  }
  return null;
}

export async function hasCloudBackup(walletId: string, accessToken?: string): Promise<boolean> {
  const cloud = getCloudBackup(walletId, accessToken);
  if (!cloud) return false;
  try {
    return await cloud.exists();
  } catch {
    return false;
  }
}

export async function createCloudBackup(
  mnemonic: string,
  walletId: string,
  accessToken?: string,
): Promise<void> {
  const cloud = getCloudBackup(walletId, accessToken);
  if (!cloud) throw new Error('Cloud backup not available on this platform');
  await cloud.uploadEncryptedKey(mnemonic, { version: 1, cloudEmail: walletId });
}

export async function restoreFromCloudBackup(
  walletId: string,
  accessToken?: string,
): Promise<string | null> {
  const cloud = getCloudBackup(walletId, accessToken);
  if (!cloud) return null;
  try {
    const backup = await cloud.downloadEncryptedKey();
    return backup?.encryptionKey ?? null;
  } catch {
    return null;
  }
}

export { CloudUnavailableError };
