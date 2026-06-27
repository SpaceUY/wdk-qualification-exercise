import { renderHook, act } from '@testing-library/react-native';

const mockHasHardwareAsync = jest.fn<Promise<boolean>, []>();
const mockIsEnrolledAsync = jest.fn<Promise<boolean>, []>();
const mockAuthenticateAsync = jest.fn<Promise<{ success: boolean; error?: string }>, [object]>();

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: () => mockHasHardwareAsync(),
  isEnrolledAsync: () => mockIsEnrolledAsync(),
  authenticateAsync: (options: object) => mockAuthenticateAsync(options),
}));

import { useBiometrics } from '../../hooks/useBiometrics';

describe('useBiometrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns false when device has no biometric hardware', async () => {
      mockHasHardwareAsync.mockResolvedValue(false);

      const { result } = await renderHook(() => useBiometrics());
      let available!: boolean;
      await act(async () => { available = await result.current.isAvailable(); });

      expect(available).toBe(false);
      expect(mockIsEnrolledAsync).not.toHaveBeenCalled();
    });

    it('returns false when hardware present but biometrics not enrolled', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(false);

      const { result } = await renderHook(() => useBiometrics());
      let available!: boolean;
      await act(async () => { available = await result.current.isAvailable(); });

      expect(available).toBe(false);
      expect(mockIsEnrolledAsync).toHaveBeenCalledTimes(1);
    });

    it('returns true when hardware present and biometrics enrolled', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(true);

      const { result } = await renderHook(() => useBiometrics());
      let available!: boolean;
      await act(async () => { available = await result.current.isAvailable(); });

      expect(available).toBe(true);
    });
  });

  describe('authenticate', () => {
    it('returns true (graceful fallback) when biometrics unavailable', async () => {
      mockHasHardwareAsync.mockResolvedValue(false);

      const { result } = await renderHook(() => useBiometrics());
      let success!: boolean;
      await act(async () => { success = await result.current.authenticate('Please authenticate'); });

      expect(success).toBe(true);
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
    });

    it('returns true when authentication succeeds', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(true);
      mockAuthenticateAsync.mockResolvedValue({ success: true });

      const { result } = await renderHook(() => useBiometrics());
      let success!: boolean;
      await act(async () => { success = await result.current.authenticate('Confirm identity'); });

      expect(success).toBe(true);
    });

    it('returns false when authentication fails', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(true);
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'UserCancel' });

      const { result } = await renderHook(() => useBiometrics());
      let success!: boolean;
      await act(async () => { success = await result.current.authenticate('Confirm identity'); });

      expect(success).toBe(false);
    });

    it('passes correct options to authenticateAsync', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(true);
      mockAuthenticateAsync.mockResolvedValue({ success: true });

      const { result } = await renderHook(() => useBiometrics());
      await act(async () => { await result.current.authenticate('My reason'); });

      expect(mockAuthenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'My reason',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });
    });

    it('propagates rejection from authenticateAsync', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(true);
      mockAuthenticateAsync.mockRejectedValue(new Error('System error'));

      const { result } = await renderHook(() => useBiometrics());
      await expect(
        act(async () => { await result.current.authenticate('reason'); }),
      ).rejects.toThrow('System error');
    });
  });
});
