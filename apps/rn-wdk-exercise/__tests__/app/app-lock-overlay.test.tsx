import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppLockOverlay } from '../../components/AppLockOverlay';

const mockUseAppLockBiometrics = jest.fn();
jest.mock('../../hooks/useAppLockBiometrics', () => ({
  useAppLockBiometrics: (...args: unknown[]) => mockUseAppLockBiometrics(...args),
}));

describe('AppLockOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when the app is not locked', async () => {
    mockUseAppLockBiometrics.mockReturnValue({ locked: false, unlock: jest.fn(), verifying: false });

    const result = await render(<AppLockOverlay />);

    expect(result.toJSON()).toBeNull();
  });

  it('shows the unlock prompt and triggers unlock when locked', async () => {
    const mockUnlock = jest.fn();
    mockUseAppLockBiometrics.mockReturnValue({ locked: true, unlock: mockUnlock, verifying: false });

    await render(<AppLockOverlay />);
    await fireEvent.press(screen.getByText('Unlock with Biometrics'));

    expect(mockUnlock).toHaveBeenCalled();
  });

  it('shows a spinner instead of the button label while verification is in progress', async () => {
    mockUseAppLockBiometrics.mockReturnValue({ locked: true, unlock: jest.fn(), verifying: true });

    await render(<AppLockOverlay />);

    expect(screen.queryByText('Unlock with Biometrics')).toBeNull();
    expect(screen.getByText('Authenticate to continue')).toBeTruthy();
  });
});
