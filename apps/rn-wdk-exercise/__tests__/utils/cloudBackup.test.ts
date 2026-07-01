// ─── Platform mock ───────────────────────────────────────────────────────────
let mockPlatformOS = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

// ─── @tetherto/wdk-backup-cloud-react-native mock ────────────────────────────
jest.mock('@tetherto/wdk-backup-cloud-react-native', () => {
  const mockExists = jest.fn();
  const mockUploadEncryptedKey = jest.fn();
  const mockDownloadEncryptedKey = jest.fn();

  const MockCloudBackup = jest.fn().mockImplementation(() => ({
    exists: mockExists,
    uploadEncryptedKey: mockUploadEncryptedKey,
    downloadEncryptedKey: mockDownloadEncryptedKey,
  }));

  const MockICloudProvider = jest.fn().mockImplementation((config: object) => config);
  const MockGoogleDriveProvider = jest.fn().mockImplementation((config: object) => config);

  class MockCloudUnavailableError extends Error {
    constructor(message = 'Cloud storage unavailable') {
      super(message);
      this.name = 'CloudUnavailableError';
    }
  }

  return {
    CloudBackup: MockCloudBackup,
    ICloudProvider: MockICloudProvider,
    GoogleDriveProvider: MockGoogleDriveProvider,
    CloudUnavailableError: MockCloudUnavailableError,
    __mockExists: mockExists,
    __mockUploadEncryptedKey: mockUploadEncryptedKey,
    __mockDownloadEncryptedKey: mockDownloadEncryptedKey,
  };
});

// ─── SUT (imported AFTER mocks) ───────────────────────────────────────────────
import { hasCloudBackup, createCloudBackup, restoreFromCloudBackup } from '../../utils/cloudBackup';

// ─── Get mock references ──────────────────────────────────────────────────────
const wdkMock = jest.requireMock('@tetherto/wdk-backup-cloud-react-native');
const MockCloudBackup = wdkMock.CloudBackup as jest.MockedClass<typeof wdkMock.CloudBackup>;
const MockICloudProvider = wdkMock.ICloudProvider as jest.MockedClass<typeof wdkMock.ICloudProvider>;
const MockGoogleDriveProvider = wdkMock.GoogleDriveProvider as jest.MockedClass<
  typeof wdkMock.GoogleDriveProvider
>;
const mockExists = wdkMock.__mockExists as jest.MockedFunction<() => Promise<boolean>>;
const mockUploadEncryptedKey = wdkMock.__mockUploadEncryptedKey as jest.MockedFunction<
  (mnemonic: string, metadata: object) => Promise<void>
>;
const mockDownloadEncryptedKey = wdkMock.__mockDownloadEncryptedKey as jest.MockedFunction<
  () => Promise<{ encryptionKey: string } | null>
>;

describe('cloudBackup', () => {
  beforeEach(() => {
    mockPlatformOS = 'ios';
    jest.clearAllMocks();
  });

  // ── hasCloudBackup ──────────────────────────────────────────────────────────
  describe('hasCloudBackup', () => {
    it('returns true when cloud backup exists on iOS', async () => {
      mockExists.mockResolvedValue(true);

      const result = await hasCloudBackup('user@test.com');

      expect(result).toBe(true);
      expect(MockICloudProvider).toHaveBeenCalledWith({
        cloudEmail: 'user@test.com',
        filePath: 'wallet_backup_user_test_com.json',
      });
    });

    it('returns false when backup does not exist on iOS', async () => {
      mockExists.mockResolvedValue(false);
      expect(await hasCloudBackup('user@test.com')).toBe(false);
    });

    it('returns false (does not throw) when exists() throws on iOS', async () => {
      mockExists.mockRejectedValue(new Error('iCloud unavailable'));
      expect(await hasCloudBackup('user@test.com')).toBe(false);
    });

    it('returns true when backup exists on Android with accessToken', async () => {
      mockPlatformOS = 'android';
      mockExists.mockResolvedValue(true);

      const result = await hasCloudBackup('user@test.com', 'my-access-token');

      expect(result).toBe(true);
      expect(MockGoogleDriveProvider).toHaveBeenCalledWith({
        accessToken: 'my-access-token',
        filePath: 'wallet_backup_user_test_com.json',
        cloudEmail: 'user@test.com',
      });
    });

    it('returns false on Android without accessToken (no cloud instance created)', async () => {
      mockPlatformOS = 'android';
      expect(await hasCloudBackup('user@test.com')).toBe(false);
      expect(MockCloudBackup).not.toHaveBeenCalled();
    });

    it('returns false on unsupported platform', async () => {
      mockPlatformOS = 'web';
      expect(await hasCloudBackup('user@test.com')).toBe(false);
      expect(MockCloudBackup).not.toHaveBeenCalled();
    });

    it('sanitizes special chars in walletId for filePath', async () => {
      mockExists.mockResolvedValue(false);
      await hasCloudBackup('user+special@test.com');
      expect(MockICloudProvider).toHaveBeenCalledWith(
        expect.objectContaining({ filePath: 'wallet_backup_user_special_test_com.json' }),
      );
    });
  });

  // ── createCloudBackup ───────────────────────────────────────────────────────
  describe('createCloudBackup', () => {
    it('calls uploadEncryptedKey with mnemonic and metadata on iOS', async () => {
      mockUploadEncryptedKey.mockResolvedValue(undefined);

      await createCloudBackup('word1 word2 word3', 'user@test.com');

      expect(mockUploadEncryptedKey).toHaveBeenCalledWith('word1 word2 word3', {
        version: 1,
        cloudEmail: 'user@test.com',
      });
    });

    it('uses GoogleDriveProvider and uploads on Android with accessToken', async () => {
      mockPlatformOS = 'android';
      mockUploadEncryptedKey.mockResolvedValue(undefined);

      await createCloudBackup('my mnemonic', 'user@test.com', 'android-token');

      expect(MockGoogleDriveProvider).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'android-token' }),
      );
      expect(mockUploadEncryptedKey).toHaveBeenCalledWith('my mnemonic', {
        version: 1,
        cloudEmail: 'user@test.com',
      });
    });

    it('throws when platform is Android without token', async () => {
      mockPlatformOS = 'android';
      await expect(createCloudBackup('mnemonic', 'user@test.com')).rejects.toThrow(
        'Cloud backup not available on this platform',
      );
    });

    it('throws on unsupported platform', async () => {
      mockPlatformOS = 'web';
      await expect(createCloudBackup('mnemonic', 'user@test.com')).rejects.toThrow(
        'Cloud backup not available on this platform',
      );
    });

    it('propagates errors from uploadEncryptedKey', async () => {
      mockUploadEncryptedKey.mockRejectedValue(new Error('Upload failed'));
      await expect(createCloudBackup('mnemonic', 'user@test.com')).rejects.toThrow('Upload failed');
    });
  });

  // ── restoreFromCloudBackup ──────────────────────────────────────────────────
  describe('restoreFromCloudBackup', () => {
    it('returns encryptionKey from downloaded backup on iOS', async () => {
      mockDownloadEncryptedKey.mockResolvedValue({ encryptionKey: 'word1 word2 word3' });
      expect(await restoreFromCloudBackup('user@test.com')).toBe('word1 word2 word3');
    });

    it('returns null when downloadEncryptedKey returns null', async () => {
      mockDownloadEncryptedKey.mockResolvedValue(null);
      expect(await restoreFromCloudBackup('user@test.com')).toBeNull();
    });

    it('returns null (does not throw) when downloadEncryptedKey throws', async () => {
      mockDownloadEncryptedKey.mockRejectedValue(new Error('Download failed'));
      expect(await restoreFromCloudBackup('user@test.com')).toBeNull();
    });

    it('returns null on Android without accessToken', async () => {
      mockPlatformOS = 'android';
      expect(await restoreFromCloudBackup('user@test.com')).toBeNull();
      expect(MockCloudBackup).not.toHaveBeenCalled();
    });

    it('returns encryptionKey on Android with accessToken', async () => {
      mockPlatformOS = 'android';
      mockDownloadEncryptedKey.mockResolvedValue({ encryptionKey: 'android mnemonic' });
      expect(await restoreFromCloudBackup('user@test.com', 'android-token')).toBe('android mnemonic');
    });

    it('returns null on unsupported platform', async () => {
      mockPlatformOS = 'web';
      expect(await restoreFromCloudBackup('user@test.com')).toBeNull();
    });
  });
});
