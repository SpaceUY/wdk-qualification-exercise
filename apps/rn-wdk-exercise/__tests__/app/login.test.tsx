import { fireEvent, render, screen } from '@testing-library/react-native';
import LoginScreen from '../../app/(auth)/index';

const mockUseCognito = jest.fn();
jest.mock('../../hooks/useCognito', () => ({
  useCognito: (...args: unknown[]) => mockUseCognito(...args),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a spinner instead of the button label while Cognito is not ready', async () => {
    mockUseCognito.mockReturnValue({ promptAsync: jest.fn(), ready: false });

    await render(<LoginScreen />);

    expect(screen.queryByText('Sign in with Cognito')).toBeNull();
    expect(screen.getByText('Sign in to access your wallet')).toBeTruthy();
  });

  it('prompts Cognito sign-in when ready and pressed', async () => {
    const mockPromptAsync = jest.fn();
    mockUseCognito.mockReturnValue({ promptAsync: mockPromptAsync, ready: true });

    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Sign in with Cognito'));

    expect(mockPromptAsync).toHaveBeenCalled();
  });
});
