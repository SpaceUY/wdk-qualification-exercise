import { useWalletManager } from '@tetherto/wdk-react-native-core';

export function useWalletData() {
  const {
    createWallet,
    restoreWallet,
    deleteWallet,
    unlock,
    lock,
    getMnemonic,
    getEncryptedSeed,
    setActiveWalletId,
    activeWalletId,
    wallets,
  } = useWalletManager();

  async function hasLocalWallet(walletId: string): Promise<boolean> {
    const encryptedSeed = await getEncryptedSeed(walletId);
    return encryptedSeed != null;
  }

  async function safeCreateWallet(walletId: string): Promise<void> {
    try {
      await createWallet(walletId);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        setActiveWalletId(walletId);
        await unlock(walletId);
      } else {
        throw err;
      }
    }
  }

  async function safeRestoreWallet(mnemonic: string, walletId: string): Promise<void> {
    const normalized = mnemonic.toLowerCase().trim().split(/\s+/).join(' ');
    try {
      await restoreWallet(normalized, walletId);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        await deleteWallet(walletId);
        await restoreWallet(normalized, walletId);
      } else {
        throw err;
      }
    }
  }

  return {
    createWallet: safeCreateWallet,
    restoreWallet: safeRestoreWallet,
    deleteWallet,
    unlock,
    lock,
    getMnemonic,
    getEncryptedSeed,
    setActiveWalletId,
    activeWalletId,
    wallets,
    hasLocalWallet,
  };
}
